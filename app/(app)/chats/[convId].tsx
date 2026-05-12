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
import {
  encryptMessage,
  decryptMessage,
  getSharedSecret,
  encryptFile,
} from '../../../src/services/encryption';
import { VideoMessage } from '../../../src/components/chat/VideoMessage';
import { AudioMessage } from '../../../src/components/chat/AudioMessage';
import { COLORS, DELETE_FOR_EVERYONE_LIMIT_MS } from '../../../src/utils/constants';
import { Message } from '../../../src/types/message';
import { Conversation } from '../../../src/types/conversation';
import { formatMessageTime, formatDateSeparator, formatDuration } from '../../../src/utils/formatTime';
import firestore from '@react-native-firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { UserProfile } from '../../../src/types/user';

export default function ConversationScreen() {
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user, keyPair } = useAuthStore();
  const { getSharedSecretFromCache, cacheSharedSecret, updateMessage } = useChatStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | null>(null);

  const { messages, loading } = useMessages(convId!, conversation);
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

        if (!data.isGroup) {
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
                setSharedSecret(secret);
              }
            }
          }
        }
      });
    return () => unsub();
  }, [convId, user, keyPair]);

  const sendTextMessage = useCallback(async () => {
    if (!inputText.trim() || !sharedSecret || !user || !convId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    onStopTyping();

    try {
      const { ciphertext, nonce } = encryptMessage(sharedSecret, text);
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
  }, [inputText, sharedSecret, user, convId, sending]);

  const pickAndSendMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !sharedSecret || !user || !convId) return;

    for (const asset of result.assets) {
      try {
        const { encryptedBytes, nonce } = await encryptFile(sharedSecret, asset.uri);
        const fileName = `${Date.now()}_${user.uid}.enc`;
        const url = await uploadEncryptedMedia(convId, fileName, encryptedBytes);
        
        const type = asset.type === 'video' ? 'video' : 'image';
        const { ciphertext: encContent, nonce: encNonce } = encryptMessage(sharedSecret, type);

        await sendMessage(convId, {
          senderId: user.uid,
          type: type,
          encryptedContent: encContent,
          nonce: encNonce,
          mediaUrl: url,
          mediaMimeType: asset.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg'),
          mediaSize: asset.fileSize,
          mediaDuration: asset.duration ? Math.floor(asset.duration / 1000) : undefined,
          reactions: {},
          readBy: {},
          deletedFor: [],
          deletedForEveryone: false,
          timestamp: firestore.FieldValue.serverTimestamp() as any,
        });
      } catch {
        Alert.alert('Upload failed', `Could not send ${asset.type}.`);
      }
    }
  };

  const pickAndSendDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !sharedSecret || !user || !convId) return;
    const file = result.assets[0];
    try {
      const { encryptedBytes, nonce } = await encryptFile(sharedSecret, file.uri);
      const fileName = `${Date.now()}_${user.uid}.enc`;
      const url = await uploadEncryptedMedia(convId, fileName, encryptedBytes);
      const { ciphertext, nonce: encNonce } = encryptMessage(sharedSecret, file.name);

      await sendMessage(convId, {
        senderId: user.uid,
        type: 'document',
        encryptedContent: ciphertext,
        nonce: encNonce,
        mediaUrl: url,
        mediaMimeType: file.mimeType ?? 'application/octet-stream',
        mediaSize: file.size,
        mediaFileName: file.name,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: firestore.FieldValue.serverTimestamp() as any,
      });
    } catch {
      Alert.alert('Upload failed', 'Could not send document.');
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
            ) : item.type === 'image' ? (
              <View>
                <Image
                  source={{ uri: item.localCacheUri ?? item.mediaUrl }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              </View>
            ) : item.type === 'video' ? (
              <VideoMessage uri={item.localCacheUri ?? item.mediaUrl!} isOwn={isOwn} />
            ) : item.type === 'document' ? (
              <View style={styles.docContainer}>
                <Text style={styles.docIcon}>📄</Text>
                <Text style={styles.docName} numberOfLines={2}>
                  {item.decryptedContent ?? item.mediaFileName ?? 'Document'}
                </Text>
              </View>
            ) : item.type === 'audio' ? (
              <AudioMessage uri={item.localCacheUri ?? item.mediaUrl!} isOwn={isOwn} />
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
            <Text style={styles.attachIcon}>📎</Text>
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
        </View>
      </KeyboardAvoidingView>
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
  mediaImage: { width: 200, height: 200, borderRadius: 12 },
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
  sendIcon: { fontSize: 18, color: '#fff' },
});
