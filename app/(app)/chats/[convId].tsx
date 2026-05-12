import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Modal, ScrollView, Image as RNImage } from 'react-native';
import { useAuthStore } from '../../../src/store/authStore';
import { useChatStore } from '../../../src/store/chatStore';
import { useMessages } from '../../../src/hooks/useMessages';
import { useTypingIndicator } from '../../../src/hooks/useTypingIndicator';
import { Avatar } from '../../../src/components/common/Avatar';
import {
  sendMessage,
  markMessagesRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  addReaction,
  uploadEncryptedMedia,
} from '../../../src/services/firestore';
import { Message, MediaItem } from '../../../src/types/message';
import { Conversation } from '../../../src/types/conversation';
import {
  encryptMessage,
  decryptMessage,
  getSharedSecret,
  encryptFile,
  decryptGroupKey,
} from '../../../src/services/encryption';
import { useAudioPlayer, useAudioRecorder, RecordingPresets, AudioModule, AudioMode } from 'expo-audio';
import { encodeBase64 } from 'tweetnacl-util';
import { VideoMessage } from '../../../src/components/chat/VideoMessage';
import { AudioMessage } from '../../../src/components/chat/AudioMessage';
import { COLORS, DELETE_FOR_EVERYONE_LIMIT_MS } from '../../../src/utils/constants';
import { formatMessageTime, formatDateSeparator, formatDuration } from '../../../src/utils/formatTime';
import firestore from '@react-native-firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { UserProfile } from '../../../src/types/user';

export default function ConversationScreen() {
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user, keyPair } = useAuthStore();
  const { 
    getSharedSecretFromCache, 
    cacheSharedSecret, 
    updateMessage,
    getGroupKeyFromCache,
    cacheGroupKey
  } = useChatStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeKey, setActiveKey] = useState<Uint8Array | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({});
  const [mediaToPreview, setMediaToPreview] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [captionText, setCaptionText] = useState('');

  const { messages, loading } = useMessages(convId!, conversation);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { typingUids, onTyping, onStopTyping } = useTypingIndicator(convId!);
  const flatListRef = useRef<FlatList>(null);

  // Load conversation + other user
  useEffect(() => {
    if (!convId || !user) return;
    const unsub = firestore()
      .collection('conversations')
      .doc(convId)
      .onSnapshot(async (doc) => {
        if (!doc || !doc.exists()) return;
        const data = { id: doc.id, ...doc.data() } as Conversation;
        setConversation(data);

        if (data.isGroup) {
          // Handle group key
          let gKey = getGroupKeyFromCache(convId);
          if (!gKey && data.encryptedGroupKeys && user && keyPair) {
            const myEncKey = data.encryptedGroupKeys[user.uid];
            if (myEncKey) {
              // Try admins to find the one who encrypted it
              const admins = data.admins || [];
              for (const adminUid of admins) {
                const adminDoc = await firestore().collection('users').doc(adminUid).get();
                const adminData = adminDoc.data();
                if (adminData?.publicKey) {
                  try {
                    gKey = decryptGroupKey(myEncKey.ciphertext, myEncKey.nonce, adminData.publicKey, keyPair.privateKey) || undefined;
                    if (gKey) {
                      cacheGroupKey(convId, gKey);
                      break;
                    }
                  } catch (e) {
                    // Try next admin
                  }
                }
              }
            }
          }
          if (gKey) setActiveKey(gKey);
        } else {
          const otherUid = data.participants.find((p) => p !== user.uid);
          if (otherUid) {
            const userDoc = await firestore().collection('users').doc(otherUid).get();
            if (userDoc.exists()) {
              const other = { uid: otherUid, ...userDoc.data() } as UserProfile;
              setOtherUser(other);

              // Compute or retrieve shared secret
              if (keyPair) {
                let secret = getSharedSecretFromCache(otherUid);
                if (!secret) {
                  secret = getSharedSecret(keyPair.privateKey, otherUid, other.publicKey);
                  cacheSharedSecret(otherUid, secret);
                }
                setActiveKey(secret);
              }
            }
          }
        }
      });
    return () => unsub();
  }, [convId, user, keyPair]);

  const sendTextMessage = useCallback(async () => {
    if (!inputText.trim() || !activeKey || !user || !convId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    onStopTyping();

    try {
      const { ciphertext, nonce } = encryptMessage(activeKey, text);
      await sendMessage(convId, {
        senderId: user.uid,
        type: 'text',
        encryptedContent: ciphertext,
        nonce,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: firestore.FieldValue.serverTimestamp() as any,
      });
    } catch (err) {
      Alert.alert('Send failed', 'Message could not be sent.');
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, activeKey, user, convId, sending]);

  const pickAndSendMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !activeKey || !user || !convId) return;
    setMediaToPreview(result.assets);
  };

  const takePhotoOrVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled || !activeKey || !user || !convId) return;
    setMediaToPreview(result.assets);
  };

  const sendMediaWithCaption = async () => {
    const assets = [...mediaToPreview];
    const caption = captionText.trim();
    setMediaToPreview([]);
    setCaptionText('');
    const tempId = `temp_${Date.now()}`;

    try {
      // Optimistic UI: One bubble for all media
      const optimisticMsg: Message = {
        id: tempId,
        senderId: user!.uid,
        type: 'media',
        encryptedContent: caption || 'Media',
        nonce: '',
        mediaItems: assets.map(a => ({
          url: a.uri,
          mimeType: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          nonce: '',
          localCacheUri: a.uri,
          size: a.fileSize,
          duration: a.duration ? Math.floor(a.duration / 1000) : undefined,
        })),
        timestamp: firestore.Timestamp.now() as any,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        isOptimistic: true,
      };
      useChatStore.getState().prependMessages(convId!, [optimisticMsg]);

      const uploadedItems: MediaItem[] = [];
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const { encryptedBytes, nonce } = await encryptFile(activeKey!, asset.uri);
        const fileName = `${Date.now()}_${user!.uid}_${i}.enc`;
        
        const url = await uploadEncryptedMedia(convId!, fileName, encryptedBytes, (p) => {
          // Track overall or per-item progress? Let's do per-item for now in a simple map
          setUploadingProgress(prev => ({ ...prev, [`${tempId}_${i}`]: p }));
        });

        uploadedItems.push({
          url,
          mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          nonce: encodeBase64(nonce),
          size: asset.fileSize,
          duration: asset.duration ? Math.floor(asset.duration / 1000) : undefined,
        });
      }
      
      const { ciphertext: encContent, nonce: encNonce } = encryptMessage(activeKey!, caption || 'media');

      await sendMessage(convId!, {
        senderId: user!.uid,
        type: 'media',
        encryptedContent: encContent,
        nonce: encNonce,
        mediaItems: uploadedItems,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: firestore.FieldValue.serverTimestamp() as any,
      });

      useChatStore.getState().updateMessage(convId!, tempId, { isOptimistic: false });
    } catch (err) {
      useChatStore.getState().updateMessage(convId!, tempId, { isError: true });
    }
  };

  const pickAndSendDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !activeKey || !user || !convId) return;
    const file = result.assets[0];
    const tempId = `temp_${Date.now()}`;
    try {
      // Optimistic UI
      const optimisticMsg: Message = {
        id: tempId,
        senderId: user.uid,
        type: 'document',
        encryptedContent: file.name,
        nonce: '',
        mediaItems: [{
          url: file.uri,
          mimeType: file.mimeType ?? 'application/octet-stream',
          nonce: '',
          fileName: file.name,
          localCacheUri: file.uri,
          size: file.size,
        }],
        timestamp: firestore.Timestamp.now() as any,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        isOptimistic: true,
      };
      useChatStore.getState().prependMessages(convId, [optimisticMsg]);

      const { encryptedBytes, nonce } = await encryptFile(activeKey, file.uri);
      const fileName = `${Date.now()}_${user.uid}.enc`;
      const url = await uploadEncryptedMedia(convId, fileName, encryptedBytes, (p) => {
        setUploadingProgress(prev => ({ ...prev, [tempId]: p }));
      });
      const { ciphertext, nonce: encNonce } = encryptMessage(activeKey, file.name);

      await sendMessage(convId, {
        senderId: user.uid,
        type: 'document',
        encryptedContent: ciphertext,
        nonce: encNonce,
        mediaItems: [{
          url,
          mimeType: file.mimeType ?? 'application/octet-stream',
          nonce: encodeBase64(nonce),
          fileName: file.name,
          size: file.size,
        }],
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: firestore.FieldValue.serverTimestamp() as any,
      });

      // Cleanup
      useChatStore.getState().updateMessage(convId, tempId, { isOptimistic: false });
    } catch {
      useChatStore.getState().updateMessage(convId, tempId, { isError: true });
      Alert.alert('Upload failed', 'Could not send document.');
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Audio recording permission is required.');
        return;
      }
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      setIsRecording(true);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopAndSendAudio = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    recorder.stop();
    const uri = recorder.uri;
    if (!uri || !activeKey || !user || !convId) return;

    const tempId = `temp_${Date.now()}`;
    try {
      const optimisticMsg: Message = {
        id: tempId,
        senderId: user.uid,
        type: 'audio',
        encryptedContent: 'Voice message',
        nonce: '',
        mediaItems: [{
          url: uri,
          mimeType: 'audio/m4a',
          nonce: '',
          localCacheUri: uri,
          duration: Math.floor(recorder.currentTime),
        }],
        timestamp: firestore.Timestamp.now() as any,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        isOptimistic: true,
      };
      useChatStore.getState().prependMessages(convId, [optimisticMsg]);

      const { encryptedBytes, nonce } = await encryptFile(activeKey, uri);
      const fileName = `${Date.now()}_${user.uid}.enc`;
      const url = await uploadEncryptedMedia(convId, fileName, encryptedBytes, (p) => {
        setUploadingProgress(prev => ({ ...prev, [tempId]: p }));
      });
      const { ciphertext: encContent, nonce: encNonce } = encryptMessage(activeKey, 'audio');

      await sendMessage(convId, {
        senderId: user.uid,
        type: 'audio',
        encryptedContent: encContent,
        nonce: encNonce,
        mediaItems: [{
          url,
          mimeType: 'audio/m4a',
          nonce: encodeBase64(nonce),
          duration: Math.floor(recorder.currentTime),
          size: 0,
        }],
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: firestore.FieldValue.serverTimestamp() as any,
      });
      useChatStore.getState().updateMessage(convId, tempId, { isOptimistic: false });
    } catch (err) {
      useChatStore.getState().updateMessage(convId, tempId, { isError: true });
      Alert.alert('Upload failed', 'Could not send voice message.');
    }
  };

  const handleLongPress = (msg: Message) => {
    if (!user) return;
    const isOwn = msg.senderId === user.uid;
    const canDeleteForEveryone =
      isOwn &&
      msg.timestamp?.toDate &&
      Date.now() - msg.timestamp.toDate().getTime() < DELETE_FOR_EVERYONE_LIMIT_MS;

    const options = [
      { text: 'Copy Text', onPress: () => {} },
      { text: 'Delete for Me', onPress: () => deleteMessageForMe(convId!, msg.id, user.uid) },
    ];
    if (canDeleteForEveryone) {
      options.push({
        text: 'Delete for Everyone',
        onPress: () => deleteMessageForEveryone(convId!, msg.id),
      });
    }
    Alert.alert('Message options', undefined, [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!user) return null;
    const isOwn = item.senderId === user.uid;
    const isDeleted = item.deletedForEveryone || item.deletedFor?.includes(user.uid);
    const showDateSeparator =
      index === messages.length - 1 ||
      formatDateSeparator(item.timestamp) !== formatDateSeparator(messages[index + 1]?.timestamp);

    const readStatus = isOwn ? (
      Object.keys(item.readBy ?? {}).some((uid) => uid !== user.uid)
        ? '✓✓'
        : Object.keys(item.readBy ?? {}).length > 0
        ? '✓✓'
        : '✓'
    ) : null;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSep}>
            <Text style={styles.dateSepText}>{formatDateSeparator(item.timestamp)}</Text>
          </View>
        )}
        <TouchableOpacity
          onLongPress={() => handleLongPress(item)}
          style={[styles.bubbleWrapper, isOwn ? styles.ownWrapper : styles.theirWrapper]}
          activeOpacity={0.8}
        >
          <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.theirBubble]}>
            {isDeleted ? (
              <Text style={styles.deletedText}>🚫 This message was deleted</Text>
            ) : item.type === 'text' ? (
              <Text style={[styles.msgText, isOwn ? styles.ownText : styles.theirText]}>
                {item.decryptedContent ?? '🔒 Decrypting...'}
              </Text>
            ) : item.type === 'media' ? (
              <View style={styles.mediaGrid}>
                {item.mediaItems?.map((m, idx) => (
                  <View key={idx} style={styles.mediaItemContainer}>
                    {m.mimeType.startsWith('image/') ? (
                      <Image
                        source={{ uri: m.localCacheUri ?? m.url }}
                        style={[styles.mediaImage, item.isOptimistic && styles.blurredMedia]}
                        resizeMode="cover"
                      />
                    ) : (
                      <VideoMessage uri={m.localCacheUri ?? m.url} isOwn={isOwn} />
                    )}
                    {item.isOptimistic && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.progressText}>
                          {Math.round((uploadingProgress[`${item.id}_${idx}`] || 0) * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                {item.decryptedContent && item.decryptedContent !== 'media' && (
                  <Text style={styles.captionText}>{item.decryptedContent}</Text>
                )}
              </View>
            ) : item.type === 'document' ? (
              <View style={[styles.docContainer, item.isOptimistic && styles.blurredMedia]}>
                <Text style={styles.docIcon}>📄</Text>
                <View style={styles.flex}>
                  <Text style={styles.docName} numberOfLines={2}>
                    {item.decryptedContent ?? item.mediaItems?.[0]?.fileName ?? 'Document'}
                  </Text>
                  {item.isOptimistic && (
                    <Text style={styles.progressText}>
                      Uploading {Math.round((uploadingProgress[item.id] || 0) * 100)}%
                    </Text>
                  )}
                </View>
              </View>
            ) : item.type === 'audio' ? (
              <View>
                <AudioMessage uri={item.mediaItems?.[0]?.localCacheUri ?? item.mediaItems?.[0]?.url!} isOwn={isOwn} />
                {item.isOptimistic && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.progressText}>
                      {Math.round((uploadingProgress[item.id] || 0) * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.msgText, isOwn ? styles.ownText : styles.theirText]}>
                {item.decryptedContent ?? '📎 Attachment'}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.msgTime}>{formatMessageTime(item.timestamp)}</Text>
              {readStatus && <Text style={styles.readReceipt}> {readStatus}</Text>}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const displayName = otherUser?.displayName ?? otherUser?.username ?? 'Chat';
  const isOnline = otherUser?.isOnline;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => otherUser && router.push(`/profile/${otherUser.uid}`)}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Avatar uri={otherUser?.photoURL} name={displayName} size="sm" online={isOnline} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.headerStatus}>
            {typingUids.length > 0 ? '✍️ typing...' : isOnline ? '🟢 Online' : 'tap for info'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={async () => {
              if (!otherUser || sending) return;
              try {
                const initiateCall = firestore().app.functions().httpsCallable('initiateCall');
                const result = await initiateCall({ receiverIds: [otherUser.uid], type: 'voice' });
                const { callId } = result.data as { callId: string };
                router.push({ pathname: `/call/${callId}`, params: { type: 'voice' } } as any);
              } catch (err) {
                Alert.alert('Call failed', 'Could not start voice call.');
              }
            }}
          >
            <Text style={styles.headerBtnIcon}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={async () => {
              if (!otherUser || sending) return;
              try {
                const initiateCall = firestore().app.functions().httpsCallable('initiateCall');
                const result = await initiateCall({ receiverIds: [otherUser.uid], type: 'video' });
                const { callId } = result.data as { callId: string };
                router.push({ pathname: `/call/${callId}`, params: { type: 'video' } } as any);
              } catch (err) {
                Alert.alert('Call failed', 'Could not start video call.');
              }
            }}
          >
            <Text style={styles.headerBtnIcon}>📹</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color={COLORS.primary} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            windowSize={5}
            maxToRenderPerBatch={10}
            removeClippedSubviews
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickAndSendMedia}>
            <Text style={styles.attachIcon}>⊕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={takePhotoOrVideo}>
            <Text style={styles.attachIcon}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={pickAndSendDocument}>
            <Text style={styles.attachIcon}>📁</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={(t) => {
              setInputText(t);
              if (t.length > 0) onTyping(); else onStopTyping();
            }}
            placeholder="Message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={4000}
            onSubmitEditing={sendTextMessage}
          />
          {inputText.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={sendTextMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendIcon}>▶</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, isRecording && styles.recordingBtn]}
              onPressIn={startRecording}
              onPressOut={stopAndSendAudio}
            >
              <Text style={styles.sendIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Preview Modal */}
      <Modal visible={mediaToPreview.length > 0} animationType="slide">
        <SafeAreaView style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setMediaToPreview([])}>
              <Text style={styles.previewClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <ScrollView contentContainerStyle={styles.previewScroll}>
            {mediaToPreview.map((asset, i) => (
              <RNImage key={i} source={{ uri: asset.uri }} style={styles.previewImage} resizeMode="contain" />
            ))}
          </ScrollView>

          <View style={styles.previewInputContainer}>
            <TextInput
              style={styles.previewInput}
              value={captionText}
              onChangeText={setCaptionText}
              placeholder="Add a caption..."
              placeholderTextColor="#ccc"
              multiline
            />
            <TouchableOpacity style={styles.previewSendBtn} onPress={sendMediaWithCaption}>
              <Text style={styles.previewSendIcon}>▶</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: 6, padding: 4 },
  backIcon: { fontSize: 28, color: COLORS.text, fontWeight: '300' },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerStatus: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },
  headerBtnIcon: { fontSize: 20 },
  loader: { flex: 1 },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  dateSep: { alignItems: 'center', marginVertical: 12 },
  dateSepText: {
    backgroundColor: COLORS.surfaceElevated,
    color: COLORS.textSecondary,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bubbleWrapper: { marginVertical: 2 },
  ownWrapper: { alignItems: 'flex-end' },
  theirWrapper: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  ownBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: COLORS.surfaceElevated, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 21 },
  ownText: { color: '#fff' },
  theirText: { color: COLORS.text },
  deletedText: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  readReceipt: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  mediaGrid: { gap: 4 },
  mediaItemContainer: { borderRadius: 12, overflow: 'hidden' },
  mediaImage: { width: 200, height: 200, borderRadius: 12 },
  blurredMedia: { opacity: 0.5 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  captionText: { color: '#fff', fontSize: 14, marginTop: 8, paddingHorizontal: 4 },
  docContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 200 },
  docIcon: { fontSize: 28 },
  docName: { fontSize: 13, color: '#fff', flex: 1 },
  audioContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioIcon: { fontSize: 20 },
  audioText: { fontSize: 13, color: '#fff' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  attachBtn: { padding: 8, marginBottom: 2 },
  attachIcon: { fontSize: 22 },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted },
  recordingBtn: { backgroundColor: COLORS.error },
  sendIcon: { fontSize: 18, color: '#fff' },
  previewModal: { flex: 1, backgroundColor: '#000' },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  previewClose: { color: '#fff', fontSize: 16 },
  previewTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  previewScroll: { padding: 10, gap: 10 },
  previewImage: { width: '100%', height: 400, borderRadius: 12 },
  previewInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    backgroundColor: '#111',
  },
  previewInput: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  previewSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSendIcon: { color: '#fff', fontSize: 18 },
});
