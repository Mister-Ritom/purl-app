import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image as RNImage,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/authStore";
import { useChatStore } from "../../src/store/chatStore";
import { useMessages } from "../../src/hooks/useMessages";
import { useTypingIndicator } from "../../src/hooks/useTypingIndicator";
import { useUserStatus } from "../../src/hooks/useUserStatus";
import { Avatar } from "../../src/components/common/Avatar";
import {
  sendMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  uploadEncryptedMedia,
} from "../../src/services/firestore";
import { Message, MediaItem } from "../../src/types/message";
import { Conversation } from "../../src/types/conversation";
import {
  encryptMessage,
  getSharedSecret,
  encryptFile,
  decryptGroupKey,
} from "../../src/services/encryption";
import * as Sharing from "expo-sharing";
import { useSoundRecorderWithStates } from "react-native-nitro-sound";
import { usePermissions } from "../../src/hooks/usePermissions";
import { encodeBase64 } from "tweetnacl-util";
import { VideoMessage } from "../../src/components/chat/VideoMessage";
import { AudioMessage } from "../../src/components/chat/AudioMessage";
import { DELETE_FOR_EVERYONE_LIMIT_MS } from "../../src/utils/constants";
import {
  formatMessageTime,
  formatDateSeparator,
} from "../../src/utils/formatTime";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { UserProfile } from "../../src/types/user";
import Ionicons from "react-native-vector-icons/dist/Ionicons";

export default function ConversationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user, keyPair } = useAuthStore();

  // Animation values for call buttons
  const voiceScale = useRef(new Animated.Value(1)).current;
  const videoScale = useRef(new Animated.Value(1)).current;

  const handleVoicePressIn = () => {
    Animated.spring(voiceScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handleVoicePressOut = () => {
    Animated.spring(voiceScale, {
      toValue: 1.0,
      useNativeDriver: true,
    }).start();
  };

  const handleVideoPressIn = () => {
    Animated.spring(videoScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handleVideoPressOut = () => {
    Animated.spring(videoScale, {
      toValue: 1.0,
      useNativeDriver: true,
    }).start();
  };

  // State
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeKey, setActiveKey] = useState<Uint8Array | null>(null);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const { requestPermission: requestMicrophonePermission } =
    usePermissions("microphone");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [uploadingStatus, setUploadingStatus] = useState<
    Record<string, { progress: number; phase: string }>
  >({});
  const [mediaToPreview, setMediaToPreview] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [captionText, setCaptionText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingMediaList, setViewingMediaList] = useState<MediaItem[] | null>(
    null,
  );

  const {
    getSharedSecretFromCache,
    cacheSharedSecret,
    updateMessage,
    getGroupKeyFromCache,
    cacheGroupKey,
  } = useChatStore();

  const { messages, loading } = useMessages(convId!, conversation);
  const recorder = useSoundRecorderWithStates({
    subscriptionDuration: 0.1,
  });
  const { typingUids, onTyping, onStopTyping } = useTypingIndicator(convId!);
  const userStatus = useUserStatus(otherUser?.uid);
  const flatListRef = useRef<FlatList>(null);

  // Load conversation + other user
  useEffect(() => {
    if (!convId || !user) return;
    const unsub = onSnapshot(
      doc(getFirestore(), "conversations", convId),
      async (docSnap) => {
        if (!docSnap || !docSnap.exists()) {
          console.warn(
            "[Chat:Snapshot] Document does not exist — creating it now...",
          );
          // Auto-create the conversation if it doesn't exist yet
          try {
            const { setDoc: fsSetDoc, serverTimestamp: fsST } =
              await import("@react-native-firebase/firestore");
            // convId format: direct_{uidA}_{uidB} — extract the other uid by removing our own
            const withoutPrefix = convId.replace("direct_", "");
            const otherUid = withoutPrefix
              .replace(user.uid, "")
              .replace(/^_|_$/, "");
            const participants = [user.uid, otherUid].filter(Boolean);
            await fsSetDoc(doc(getFirestore(), "conversations", convId), {
              participants,
              isGroup: false,
              createdAt: fsST(),
              updatedAt: fsST(),
              lastMessage: null,
              inviteKeyUsed: "self-healed",
            });
            console.log(
              "[Chat:Snapshot] ✅ Conversation created with participants:",
              participants,
            );
          } catch (err) {
            console.error(
              "[Chat:Snapshot] ❌ Failed to create conversation:",
              err,
            );
          }
          return;
        }
        const data = { id: docSnap.id, ...docSnap.data() } as Conversation;
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
                const adminDocSnap = await getDoc(
                  doc(getFirestore(), "users", adminUid),
                );
                const adminData = adminDocSnap.data();
                if (adminData?.publicKey) {
                  try {
                    gKey =
                      decryptGroupKey(
                        myEncKey.ciphertext,
                        myEncKey.nonce,
                        adminData.publicKey,
                        keyPair.privateKey,
                      ) || undefined;
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
            const userDocSnap = await getDoc(
              doc(getFirestore(), "users", otherUid),
            );
            if (userDocSnap.exists()) {
              const other = {
                uid: otherUid,
                ...userDocSnap.data(),
              } as UserProfile;
              setOtherUser(other);

              // Compute or retrieve shared secret
              if (keyPair) {
                if (!other.publicKey) {
                  setEncryptionError(
                    "This user has not set up encryption keys yet. Messages cannot be sent.",
                  );
                  console.warn(
                    "[Chat:Encryption] ❌ Other user has NO publicKey — uid:",
                    otherUid,
                  );
                } else {
                  try {
                    let secret = getSharedSecretFromCache(otherUid);
                    if (!secret) {
                      secret = getSharedSecret(
                        keyPair.privateKey,
                        otherUid,
                        other.publicKey,
                      );
                      cacheSharedSecret(otherUid, secret);
                    }
                    setActiveKey(secret);
                    setEncryptionError(null);
                  } catch (e) {
                    setEncryptionError(
                      "Failed to set up encryption. Try reopening the chat.",
                    );
                    console.error(
                      "[Chat:Encryption] ❌ Failed to compute shared secret:",
                      e,
                    );
                  }
                }
              } else {
                console.warn(
                  "[Chat:Encryption] ❌ keyPair is NULL — cannot compute secret",
                );
                setEncryptionError(
                  "Your encryption keys are not loaded. Try logging out and back in.",
                );
              }
            } else {
              console.warn(
                "[Chat:OtherUser] ❌ Other user doc does not exist in Firestore — uid:",
                otherUid,
              );
            }
          } else {
            console.warn(
              "[Chat:DM] ❌ Could not find otherUid in participants:",
              data.participants,
            );
          }
        }
      },
    );
    return () => unsub();
  }, [convId, user, keyPair]);

  const sendTextMessage = useCallback(async () => {
    console.log("[Send] Guards —", {
      hasText: !!inputText.trim(),
      hasKey: !!activeKey,
      hasUser: !!user,
      hasConvId: !!convId,
      sending,
    });
    if (!inputText.trim() || !activeKey || !user || !convId || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    onStopTyping();

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user.uid,
      type: "text",
      encryptedContent: "", // Not used for display
      decryptedContent: text,
      nonce: "",
      reactions: {},
      readBy: {},
      deletedFor: [],
      deletedForEveryone: false,
      timestamp: Timestamp.now() as any,
      isOptimistic: true,
    };

    useChatStore.getState().prependMessages(convId, [optimisticMsg]);

    try {
      const { ciphertext, nonce } = encryptMessage(activeKey, text);

      useChatStore.getState().removeMessage(convId, tempId);

      await sendMessage(convId, {
        senderId: user.uid,
        type: "text",
        encryptedContent: ciphertext,
        nonce,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: serverTimestamp() as any,
      });
    } catch (err) {
      Alert.alert("Send failed", "Message could not be sent.");
      setInputText(text);
      // Remove optimistic message on error
      useChatStore.getState().removeMessage(convId, tempId);
    } finally {
      setSending(false);
    }
  }, [inputText, activeKey, user, convId, sending]);

  const pickAndSendMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Allow access to photos to share media.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !activeKey || !user || !convId) return;
    setMediaToPreview(result.assets);
  };

  const takePhotoOrVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Allow access to camera to take photos/videos.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (result.canceled || !activeKey || !user || !convId) return;
    setMediaToPreview(result.assets);
  };

  // Removed stray JSX opening tag that was misplaced

  const sendMediaWithCaption = async () => {
    const assets = [...mediaToPreview];
    const caption = captionText.trim();
    console.log(
      "[Media] Starting send — Assets:",
      assets.length,
      "Caption:",
      caption,
    );
    setMediaToPreview([]);
    setCaptionText("");
    const tempId = `temp_${Date.now()}`;

    try {
      // Optimistic UI: One bubble for all media
      const optimisticMsg: Message = {
        id: tempId,
        senderId: user!.uid,
        type: "media",
        encryptedContent: "",
        decryptedContent: caption || "Media",
        nonce: "",
        mediaItems: assets.map((a) => ({
          url: a.uri,
          mimeType:
            a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
          nonce: "",
          localCacheUri: a.uri,
          size: a.fileSize,
          duration: a.duration ? Math.floor(a.duration / 1000) : undefined,
        })),
        timestamp: Timestamp.now() as any,
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
        const statusKey = `${tempId}_${i}`;
        console.log(`[Media] Processing item ${i} — URI:`, asset.uri);

        setUploadingStatus((prev) => ({
          ...prev,
          [statusKey]: { progress: 0, phase: "Encrypting" },
        }));

        const { encryptedBytes, nonce } = await encryptFile(
          activeKey!,
          asset.uri,
        );
        console.log(`[Media] Item ${i} encrypted. Uploading...`);

        setUploadingStatus((prev) => ({
          ...prev,
          [statusKey]: { progress: 0, phase: "Uploading" },
        }));

        const fileName = `${Date.now()}_${user!.uid}_${i}.enc`;
        const url = await uploadEncryptedMedia(
          convId!,
          fileName,
          encryptedBytes,
          (p) => {
            setUploadingStatus((prev) => ({
              ...prev,
              [statusKey]: { progress: p, phase: "Uploading" },
            }));
          },
        );
        console.log(`[Media] Item ${i} upload complete. URL:`, url);

        setUploadingStatus((prev) => ({
          ...prev,
          [statusKey]: { progress: 1, phase: "Finalizing" },
        }));

        uploadedItems.push({
          url,
          mimeType:
            asset.mimeType ??
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
          nonce: encodeBase64(nonce),
          size: asset.fileSize ?? null,
          duration: asset.duration ? Math.floor(asset.duration / 1000) : null,
        });
      }

      console.log("[Media] All items uploaded. Sending Firestore message...");
      const { ciphertext: encContent, nonce: encNonce } = encryptMessage(
        activeKey!,
        caption || "media",
      );

      await sendMessage(convId!, {
        senderId: user!.uid,
        type: "media",
        encryptedContent: encContent,
        nonce: encNonce,
        mediaItems: uploadedItems,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: serverTimestamp() as any,
      });

      console.log("[Media] Firestore message sent successfully.");
      useChatStore
        .getState()
        .updateMessage(convId!, tempId, { isOptimistic: false });

      // Clear status after success
      setUploadingStatus((prev) => {
        const next = { ...prev };
        assets.forEach((_, i) => delete next[`${tempId}_${i}`]);
        return next;
      });
    } catch (err) {
      console.error("[Media] ❌ Sending failed:", err);
      Alert.alert("Send failed", "Media could not be sent.");
      useChatStore.getState().updateMessage(convId!, tempId, { isError: true });
    }
  };

  const pickAndSendDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !activeKey || !user || !convId) return;
    const file = result.assets[0];
    const tempId = `temp_${Date.now()}`;
    try {
      // Optimistic UI
      const optimisticMsg: Message = {
        id: tempId,
        senderId: user.uid,
        type: "document",
        encryptedContent: "",
        decryptedContent: file.name,
        nonce: "",
        mediaItems: [
          {
            url: file.uri,
            mimeType: file.mimeType ?? "application/octet-stream",
            nonce: "",
            fileName: file.name,
            localCacheUri: file.uri,
            size: file.size,
          },
        ],
        timestamp: Timestamp.now() as any,
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        isOptimistic: true,
      };
      useChatStore.getState().prependMessages(convId, [optimisticMsg]);

      setUploadingStatus((prev) => ({
        ...prev,
        [tempId]: { progress: 0, phase: "Encrypting" },
      }));
      const { encryptedBytes, nonce } = await encryptFile(activeKey, file.uri);

      setUploadingStatus((prev) => ({
        ...prev,
        [tempId]: { progress: 0, phase: "Uploading" },
      }));
      const fileName = `${Date.now()}_${user.uid}.enc`;
      const url = await uploadEncryptedMedia(
        convId,
        fileName,
        encryptedBytes,
        (p) => {
          setUploadingStatus((prev) => ({
            ...prev,
            [tempId]: { progress: p, phase: "Uploading" },
          }));
        },
      );
      setUploadingStatus((prev) => ({
        ...prev,
        [tempId]: { progress: 1, phase: "Finalizing" },
      }));
      const { ciphertext, nonce: encNonce } = encryptMessage(
        activeKey,
        file.name,
      );

      await sendMessage(convId, {
        senderId: user.uid,
        type: "document",
        encryptedContent: ciphertext,
        nonce: encNonce,
        mediaItems: [
          {
            url,
            mimeType: file.mimeType ?? "application/octet-stream",
            nonce: encodeBase64(nonce),
            fileName: file.name,
            size: file.size,
          },
        ],
        reactions: {},
        readBy: {},
        deletedFor: [],
        deletedForEveryone: false,
        timestamp: serverTimestamp() as any,
      });

      // Cleanup
      useChatStore
        .getState()
        .updateMessage(convId, tempId, { isOptimistic: false });
    } catch {
      useChatStore.getState().updateMessage(convId, tempId, { isError: true });
      Alert.alert("Upload failed", "Could not send document.");
    }
  };

  const openDocument = async (uri: string, fileName?: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: undefined,
          dialogTitle: fileName || "Open Document",
        });
      }
    } catch (e) {
      console.error("Error opening document:", e);
      Alert.alert("Error", "Could not open the document.");
    }
  };

  const shareMedia = async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.error("[ConversationScreen] Sharing failed:", e);
      Alert.alert("Error", "Could not share this file.");
    }
  };

  const startRecording = async () => {
    if (isRecordingLoading || isRecording) return;
    try {
      setIsRecordingLoading(true);
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          "Permission denied",
          "Audio recording permission is required.",
        );
        setIsRecordingLoading(false);
        return;
      }
      setIsRecording(true);
      await recorder.startRecorder();
    } catch (err) {
      console.error("Failed to start recording", err);
      setIsRecording(false);
      Alert.alert("Error", "Failed to start audio recording.");
    } finally {
      setIsRecordingLoading(false);
    }
  };

  const stopAndSendAudio = async () => {
    if (isRecordingLoading) return;
    if (!isRecording) return;
    try {
      setIsRecordingLoading(true);
      setIsRecording(false);
      const uri = await recorder.stopRecorder();
      if (!uri || !activeKey || !user || !convId) {
        setIsRecordingLoading(false);
        return;
      }

      const tempId = `temp_${Date.now()}`;
      try {
        const optimisticMsg: Message = {
          id: tempId,
          senderId: user.uid,
          type: "audio",
          encryptedContent: "",
          decryptedContent: "Voice message",
          nonce: "",
          mediaItems: [
            {
              url: uri,
              mimeType: "audio/m4a",
              nonce: "",
              localCacheUri: uri,
              duration: Math.floor(recorder.state.currentPosition / 1000),
            },
          ],
          timestamp: Timestamp.now() as any,
          reactions: {},
          readBy: {},
          deletedFor: [],
          deletedForEveryone: false,
          isOptimistic: true,
        };
        useChatStore.getState().prependMessages(convId, [optimisticMsg]);

        setUploadingStatus((prev) => ({
          ...prev,
          [tempId]: { progress: 0, phase: "Encrypting" },
        }));
        const { encryptedBytes, nonce } = await encryptFile(activeKey, uri);

        setUploadingStatus((prev) => ({
          ...prev,
          [tempId]: { progress: 0, phase: "Uploading" },
        }));
        const fileName = `${Date.now()}_${user.uid}.enc`;
        const url = await uploadEncryptedMedia(
          convId,
          fileName,
          encryptedBytes,
          (p) => {
            setUploadingStatus((prev) => ({
              ...prev,
              [tempId]: { progress: p, phase: "Uploading" },
            }));
          },
        );
        setUploadingStatus((prev) => ({
          ...prev,
          [tempId]: { progress: 1, phase: "Finalizing" },
        }));
        const { ciphertext: encContent, nonce: encNonce } = encryptMessage(
          activeKey,
          "audio",
        );

        await sendMessage(convId, {
          senderId: user.uid,
          type: "audio",
          encryptedContent: encContent,
          nonce: encNonce,
          mediaItems: [
            {
              url,
              mimeType: "audio/m4a",
              nonce: encodeBase64(nonce),
              duration: Math.floor(recorder.state.currentPosition / 1000),
              size: 0,
            },
          ],
          reactions: {},
          readBy: {},
          deletedFor: [],
          deletedForEveryone: false,
          timestamp: serverTimestamp() as any,
        });
        useChatStore
          .getState()
          .updateMessage(convId, tempId, { isOptimistic: false });
      } catch (err) {
        useChatStore
          .getState()
          .updateMessage(convId, tempId, { isError: true });
        Alert.alert("Upload failed", "Could not send voice message.");
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
      Alert.alert("Error", "Failed to stop recording.");
    } finally {
      setIsRecordingLoading(false);
    }
  };

  const handleLongPress = (msg: Message) => {
    if (!user) return;
    const isOwn = msg.senderId === user.uid;
    const canDeleteForEveryone =
      isOwn &&
      msg.timestamp?.toDate &&
      Date.now() - msg.timestamp.toDate().getTime() <
        DELETE_FOR_EVERYONE_LIMIT_MS;
    const hasMedia =
      msg.mediaItems &&
      msg.mediaItems.length > 0 &&
      msg.mediaItems.some((i) => i.localCacheUri);

    const options = [
      {
        text: "Copy Text",
        onPress: () => {
          if (msg.decryptedContent) {
            import("expo-clipboard").then((c) => {
              c.setStringAsync(msg.decryptedContent!);
              Alert.alert("Copied!");
            });
          }
        },
      },
      {
        text: "Select",
        onPress: () => {
          setIsSelectionMode(true);
          setSelectedMessages([msg.id]);
        },
      },
      {
        text: "Delete for Me",
        onPress: () => deleteMessageForMe(convId!, msg.id, user.uid),
      },
    ];
    if (hasMedia) {
      options.push({
        text: "Share/Save",
        onPress: () => {
          const item = msg.mediaItems?.find((i) => i.localCacheUri);
          if (item?.localCacheUri) shareMedia(item.localCacheUri);
        },
      });
    }
    if (canDeleteForEveryone) {
      options.push({
        text: "Delete for Everyone",
        onPress: () => deleteMessageForEveryone(convId!, msg.id),
      });
    }
    Alert.alert("Message options", undefined, [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!user) return null;
    const isOwn = item.senderId === user.uid;
    const isDeleted =
      item.deletedForEveryone || item.deletedFor?.includes(user.uid);
    const showDateSeparator =
      index === messages.length - 1 ||
      formatDateSeparator(item.timestamp) !==
        formatDateSeparator(messages[index + 1]?.timestamp);

    const readStatus = isOwn
      ? Object.keys(item.readBy ?? {}).some((uid) => uid !== user.uid)
        ? "✓✓"
        : Object.keys(item.readBy ?? {}).length > 0
          ? "✓✓"
          : "✓"
      : null;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSep}>
            <View type="surfaceElevated" style={styles.dateSepText}>
              <Text type="textSecondary" style={{ fontSize: 12 }}>
                {formatDateSeparator(item.timestamp)}
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          onLongPress={() => handleLongPress(item)}
          style={[
            styles.bubbleWrapper,
            isOwn ? styles.ownWrapper : styles.theirWrapper,
          ]}
          activeOpacity={0.8}
        >
          <View
            type={isOwn ? undefined : "surfaceElevated"}
            style={[
              styles.bubble,
              isOwn ? styles.ownBubble : styles.theirBubble,
            ]}
          >
            {isDeleted ? (
              <Text style={styles.deletedText}>
                🚫 This message was deleted
              </Text>
            ) : item.type === "text" ? (
              <Text
                style={[
                  styles.msgText,
                  isOwn ? styles.ownText : styles.theirText,
                ]}
                type={isOwn ? undefined : "text"}
              >
                {item.decryptedContent ?? "🔒 Decrypting..."}
              </Text>
            ) : item.type === "media" ||
              item.type === "document" ||
              item.type === "audio" ? (
              <View>
                {(() => {
                  const mediaItems = item.mediaItems || [];
                  const imagesAndVideos = mediaItems.filter(
                    (m) =>
                      m.mimeType.startsWith("image/") ||
                      m.mimeType.startsWith("video/"),
                  );
                  const docs = mediaItems.filter(
                    (m) =>
                      !m.mimeType.startsWith("image/") &&
                      !m.mimeType.startsWith("video/") &&
                      !m.mimeType.startsWith("audio/"),
                  );
                  const audios = mediaItems.filter((m) =>
                    m.mimeType.startsWith("audio/"),
                  );

                  const renderMediaItem = (
                    m: MediaItem,
                    idx: number,
                    total: number,
                  ) => {
                    const isReady = !!m.localCacheUri;
                    const isLast = idx === 3 && total > 4;
                    const remainingCount = total - 3;

                    const itemSizeStyle = (() => {
                      if (total === 1) return { width: 240, height: 240 };
                      if (total === 2) return { width: 118, height: 118 };
                      if (total === 3) {
                        if (idx === 0) return { width: 240, height: 140 };
                        return { width: 118, height: 118 };
                      }
                      return { width: 118, height: 118 };
                    })();

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.mediaGridItem, itemSizeStyle]}
                        onPress={() => {
                          if (isLast) {
                            setViewingMediaList(imagesAndVideos);
                          } else if (isReady) {
                            if (m.mimeType.startsWith("image/")) {
                              setSelectedImage(m.localCacheUri!);
                            }
                          }
                        }}
                        disabled={!isReady && !isLast}
                      >
                        {m.mimeType.startsWith("image/") ? (
                          <View style={styles.flex}>
                            {m.localCacheUri ? (
                              <Image
                                source={m.localCacheUri}
                                style={[
                                  styles.mediaGridImage,
                                  (item.isOptimistic || !isReady) &&
                                    styles.blurredMedia,
                                ]}
                                contentFit="cover"
                                onError={(e) =>
                                  console.log(
                                    "[expo-image] Error loading image:",
                                    e.error,
                                    "URI:",
                                    m.localCacheUri,
                                  )
                                }
                              />
                            ) : (
                              <View style={styles.mediaGridImage} />
                            )}
                            {!isReady && !item.isOptimistic && (
                              <View style={styles.decryptOverlay}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.decryptText}>
                                  {item.isError
                                    ? "Decryption failed"
                                    : "Decrypting..."}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <View style={styles.flex}>
                            {isReady ? (
                              <VideoMessage
                                uri={m.localCacheUri!}
                                isOwn={isOwn}
                              />
                            ) : (
                              <View style={styles.videoPlaceholderGrid}>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.decryptText}>
                                  {item.isOptimistic
                                    ? "Uploading..."
                                    : "Decrypting..."}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {item.isOptimistic && (
                          <View style={styles.uploadOverlay}>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.progressText}>
                              {uploadingStatus[`${item.id}_${idx}`]?.phase ===
                              "Encrypting"
                                ? "Encrypting..."
                                : uploadingStatus[`${item.id}_${idx}`]
                                      ?.phase === "Finalizing"
                                  ? "Finalizing..."
                                  : `${Math.round((uploadingStatus[`${item.id}_${idx}`]?.progress || 0) * 100)}%`}
                            </Text>
                          </View>
                        )}
                        {isLast && (
                          <View style={styles.moreMediaOverlay}>
                            <Text style={styles.moreMediaText}>
                              +{remainingCount}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  };

                  return (
                    <View style={styles.mediaContainer}>
                      {imagesAndVideos.length > 0 && (
                        <View style={styles.mediaGridWrapper}>
                          {imagesAndVideos
                            .slice(0, 4)
                            .map((m, idx) =>
                              renderMediaItem(m, idx, imagesAndVideos.length),
                            )}
                        </View>
                      )}

                      {docs.length > 0 && (
                        <View style={styles.docsSection}>
                          {docs.map((docItem, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.docContainer,
                                item.isOptimistic && styles.blurredMedia,
                              ]}
                              onPress={() => {
                                if (docItem.localCacheUri) {
                                  openDocument(
                                    docItem.localCacheUri,
                                    docItem.fileName || undefined,
                                  );
                                }
                              }}
                              disabled={!docItem.localCacheUri}
                            >
                              <Text
                                style={[
                                  styles.docIcon,
                                  { color: isOwn ? "#fff" : colors.primary },
                                ]}
                              >
                                📄
                              </Text>
                              <View style={styles.flex}>
                                <Text
                                  style={[
                                    styles.docName,
                                    { color: isOwn ? "#fff" : colors.text },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {docItem.fileName || "Document"}
                                </Text>
                                {!docItem.localCacheUri &&
                                  !item.isOptimistic && (
                                    <Text style={styles.decryptTextSmall}>
                                      Decrypting...
                                    </Text>
                                  )}
                                {item.isOptimistic && (
                                  <Text style={styles.decryptTextSmall}>
                                    {uploadingStatus[item.id]?.phase ===
                                    "Encrypting"
                                      ? "Encrypting..."
                                      : uploadingStatus[item.id]?.phase ===
                                          "Finalizing"
                                        ? "Finalizing..."
                                        : `${Math.round((uploadingStatus[item.id]?.progress || 0) * 100)}% Uploading`}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {audios.length > 0 && (
                        <View style={styles.audioSection}>
                          {audios.map((audioItem, idx) => (
                            <View key={idx}>
                              {audioItem.localCacheUri ? (
                                <AudioMessage
                                  uri={audioItem.localCacheUri}
                                  isOwn={isOwn}
                                />
                              ) : (
                                <View style={styles.audioPlaceholder}>
                                  <ActivityIndicator
                                    size="small"
                                    color={isOwn ? "#fff" : colors.primary}
                                  />
                                  <Text
                                    style={[
                                      styles.decryptTextSmall,
                                      { marginLeft: 8 },
                                      isOwn
                                        ? { color: "#fff" }
                                        : { color: colors.textSecondary },
                                    ]}
                                  >
                                    {item.isOptimistic
                                      ? uploadingStatus[item.id]?.phase ===
                                        "Encrypting"
                                        ? "Encrypting..."
                                        : uploadingStatus[item.id]?.phase ===
                                            "Finalizing"
                                          ? "Finalizing..."
                                          : `${Math.round((uploadingStatus[item.id]?.progress || 0) * 100)}% Uploading`
                                      : "Decrypting voice..."}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {item.decryptedContent &&
                        item.decryptedContent !== "media" &&
                        item.decryptedContent !== "audio" &&
                        !docs.some(
                          (d) => d.fileName === item.decryptedContent,
                        ) && (
                          <Text
                            style={[
                              styles.captionText,
                              isOwn ? styles.ownText : styles.theirText,
                            ]}
                          >
                            {item.decryptedContent}
                          </Text>
                        )}
                    </View>
                  );
                })()}
              </View>
            ) : (
              <Text
                style={[
                  styles.msgText,
                  isOwn ? styles.ownText : styles.theirText,
                ]}
              >
                {item.decryptedContent ?? "📎 Attachment"}
              </Text>
            )}
            <View
              style={styles.metaRow}
              lightColor="transparent"
              darkColor="transparent"
            >
              <Text
                style={[
                  styles.msgTime,
                  isOwn ? { color: "rgba(255,255,255,0.6)" } : null,
                ]}
                type={isOwn ? "text" : "textSecondary"}
              >
                {formatMessageTime(item.timestamp)}
              </Text>
              {readStatus && (
                <Text
                  style={[
                    styles.readReceipt,
                    isOwn ? { color: "rgba(255,255,255,0.7)" } : null,
                  ]}
                  type={isOwn ? "text" : "textSecondary"}
                >
                  {" "}
                  {readStatus}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const displayName = otherUser?.displayName ?? otherUser?.username ?? "Chat";
  const isOnline = userStatus.online;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfoWrapper}
          onPress={() => otherUser && router.push(`/profile/${otherUser.uid}`)}
        >
          <Avatar
            uri={otherUser?.photoURL}
            name={displayName}
            size="sm"
            online={isOnline}
          />
          <View style={styles.headerInfo}>
            <Text
              style={[styles.headerName, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.headerStatus, { color: colors.textSecondary }]}
            >
              {typingUids.length > 0
                ? "✍️ typing..."
                : isOnline
                  ? "🟢 Online"
                  : "tap for info"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPressIn={handleVoicePressIn}
            onPressOut={handleVoicePressOut}
            onPress={() => {
              if (!otherUser) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: `/call/outgoing`,
                params: {
                  isOutgoing: "true",
                  receiverId: otherUser.uid,
                  receiverName: displayName,
                  receiverPhoto: otherUser.photoURL ?? "",
                  type: "voice",
                },
              } as any);
            }}
          >
            <Animated.View style={{ transform: [{ scale: voiceScale }] }}>
              <Text style={styles.headerBtnIcon}>📞</Text>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPressIn={handleVideoPressIn}
            onPressOut={handleVideoPressOut}
            onPress={() => {
              if (!otherUser) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: `/call/outgoing`,
                params: {
                  isOutgoing: "true",
                  receiverId: otherUser.uid,
                  receiverName: displayName,
                  receiverPhoto: otherUser.photoURL ?? "",
                  type: "video",
                },
              } as any);
            }}
          >
            <Animated.View style={{ transform: [{ scale: videoScale }] }}>
              <Text style={styles.headerBtnIcon}>📹</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        {encryptionError && (
          <View style={styles.encryptionBanner}>
            <Text style={styles.encryptionBannerText}>
              🔒 {encryptionError}
            </Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
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

        {!isSelectionMode && (
          <View
            style={[
              styles.inputBar,
              {
                paddingBottom: insets.bottom + 8,
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={pickAndSendMedia}
            >
              <Text style={styles.attachIcon}>⊕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={takePhotoOrVideo}
            >
              <Text style={styles.attachIcon}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={pickAndSendDocument}
            >
              <Text style={styles.attachIcon}>📁</Text>
            </TouchableOpacity>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={inputText}
              onChangeText={(t) => {
                setInputText(t);
                if (t.length > 0) onTyping();
                else onStopTyping();
              }}
              placeholder="Message..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              onSubmitEditing={sendTextMessage}
            />
            {inputText.trim() ? (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !inputText.trim() && styles.sendBtnDisabled,
                ]}
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
                style={[
                  styles.sendBtn,
                  isRecording && styles.recordingBtn,
                  isRecordingLoading && styles.sendBtnDisabled,
                ]}
                onPressIn={startRecording}
                onPressOut={stopAndSendAudio}
                disabled={isRecordingLoading}
              >
                {isRecordingLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendIcon}>
                    {isRecording ? "⏹" : "🎤"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {isSelectionMode && (
          <View
            style={[
              styles.selectionBar,
              {
                paddingBottom: insets.bottom + 8,
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedMessages([]);
              }}
              style={styles.selectionBtn}
            >
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectionTitle}>
              {selectedMessages.length} selected
            </Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Delete Messages",
                  `Delete ${selectedMessages.length} messages?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        selectedMessages.forEach((mid) =>
                          deleteMessageForMe(convId!, mid, user!.uid),
                        );
                        setIsSelectionMode(false);
                        setSelectedMessages([]);
                      },
                    },
                  ],
                );
              }}
              style={styles.selectionBtn}
              disabled={selectedMessages.length === 0}
            >
              <Text
                style={{
                  color:
                    selectedMessages.length > 0
                      ? colors.error
                      : colors.textMuted,
                  fontWeight: "600",
                }}
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Media Preview Modal */}
      <Modal visible={mediaToPreview.length > 0} animationType="slide">
        <View
          style={[
            styles.previewModal,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setMediaToPreview([])}>
              <Text style={styles.previewClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView contentContainerStyle={styles.previewScroll}>
            {mediaToPreview.map((asset, i) => (
              <Image
                key={i}
                source={{ uri: asset.uri }}
                style={styles.previewImage}
                contentFit="contain"
                transition={200}
              />
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
            <TouchableOpacity
              style={styles.previewSendBtn}
              onPress={sendMediaWithCaption}
            >
              <Text style={styles.previewSendIcon}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Fullscreen Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color={colors.surface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fullscreenShare}
            onPress={() => selectedImage && shareMedia(selectedImage)}
          >
            <Ionicons name="arrow-up-circle" size={32} color={colors.surface} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              contentFit="contain"
              transition={200}
            />
          )}
        </View>
      </Modal>

      {/* All Media List Modal */}
      <Modal
        visible={!!viewingMediaList}
        animationType="slide"
        onRequestClose={() => setViewingMediaList(null)}
      >
        <View
          style={[
            styles.previewModal,
            {
              paddingTop: insets.top,
              backgroundColor: colors.background,
            },
          ]}
        >
          <View
            style={[
              styles.previewHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setViewingMediaList(null)}>
              <Text style={[styles.previewClose, { color: colors.primary }]}>
                Close
              </Text>
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              All Media ({viewingMediaList?.length})
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView contentContainerStyle={styles.mediaListScroll}>
            {viewingMediaList?.map((m, i) => (
              <View key={i} style={styles.mediaListEntry}>
                {m.mimeType.startsWith("image/") ? (
                  <TouchableOpacity
                    onPress={() => setSelectedImage(m.localCacheUri ?? m.url)}
                  >
                    <MediaListImage uri={m.localCacheUri ?? m.url} />
                  </TouchableOpacity>
                ) : (
                  <MediaListVideo uri={m.localCacheUri ?? m.url} />
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Internal helper for media list to handle dynamic aspect ratios
const MediaListImage = ({ uri }: { uri: string }) => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  useEffect(() => {
    RNImage.getSize(
      uri,
      (w, h) => setAspectRatio(w / h),
      () => setAspectRatio(1),
    );
  }, [uri]);

  return (
    <Image
      source={uri}
      style={[
        styles.mediaListImage,
        aspectRatio ? { aspectRatio } : { height: 300 },
      ]}
      contentFit="contain"
      onError={(e) =>
        console.log("[expo-image:modal] Error:", e.error, "URI:", uri)
      }
    />
  );
};

const MediaListVideo = ({ uri }: { uri: string }) => {
  return (
    <VideoMessage
      uri={uri}
      isOwn={false}
      style={styles.mediaListVideo}
      contentFit="contain"
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: { padding: 4, marginRight: 8 },
  backIcon: { fontSize: 32, fontWeight: "300" },
  headerInfoWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: "700" },
  headerStatus: { fontSize: 13 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: { padding: 8 },
  headerBtnIcon: { fontSize: 20 },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  selectionBtn: { padding: 8 },
  selectionTitle: { fontSize: 16, fontWeight: "700" },
  flex: { flex: 1 },
  encryptionBanner: {
    backgroundColor: "#7c2d12",
    padding: 10,
    alignItems: "center",
  },
  encryptionBannerText: { color: "#fca5a5", fontSize: 13, textAlign: "center" },
  loader: { flex: 1 },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  dateSep: { alignItems: "center", marginVertical: 12 },
  dateSepText: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bubbleWrapper: { marginVertical: 2 },
  ownWrapper: { alignItems: "flex-end" },
  theirWrapper: { alignItems: "flex-start" },
  bubble: {
    padding: 10,
    borderRadius: 18,
    maxWidth: "78%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  ownBubble: { backgroundColor: "#6366F1", borderBottomRightRadius: 4 }, // Use a nice indigo for primary
  theirBubble: { borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 21 },
  ownText: { color: "#fff" },
  theirText: {},
  deletedText: { fontSize: 14, fontStyle: "italic", opacity: 0.6 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  msgTime: { fontSize: 11 },
  readReceipt: { fontSize: 11 },
  mediaGridWrapper: {
    width: 240,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  mediaGridItem: {
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#121212",
  },
  mediaGridImage: {
    width: "100%",
    height: "100%",
  },
  moreMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreMediaText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  mediaContainer: {
    gap: 4,
  },
  docsSection: {
    gap: 4,
    marginTop: 4,
  },
  audioSection: {
    gap: 4,
    marginTop: 4,
  },
  blurredMedia: { opacity: 0.5 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  decryptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  decryptText: { color: "#fff", fontSize: 12, marginTop: 4 },
  decryptTextSmall: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  progressText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  captionText: {
    marginTop: 8,
    fontSize: 15,
    paddingHorizontal: 4,
  },
  docContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    minWidth: 200,
    maxWidth: 240,
    gap: 10,
  },
  docIcon: { fontSize: 24 },
  docName: { fontSize: 14, fontWeight: "500", flex: 1 },
  audioPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    minWidth: 150,
  },
  videoPlaceholderGrid: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaListScroll: { padding: 16, gap: 16 },
  mediaListEntry: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  mediaListImage: { width: "100%", backgroundColor: "rgba(0,0,0,0.05)" },
  mediaListVideo: { width: "100%", height: 300, backgroundColor: "#000" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: "#121212",
    borderTopWidth: 1,
    borderTopColor: "#272729",
    gap: 8,
  },
  attachBtn: { padding: 8, marginBottom: 2 },
  attachIcon: { fontSize: 22 },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  recordingBtn: { backgroundColor: "#FF3B30" },
  sendIcon: { fontSize: 18, color: "#fff" },
  previewModal: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  previewClose: { fontSize: 16, fontWeight: "600" },
  previewTitle: { fontSize: 17, fontWeight: "600" },
  previewScroll: { padding: 10, gap: 10 },
  previewImage: { width: "100%", height: 400, borderRadius: 12 },
  previewInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 12,
    backgroundColor: "#111",
  },
  previewInput: {
    flex: 1,
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 100,
  },
  previewSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  previewSendIcon: { color: "#fff", fontSize: 18 },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullscreenCloseText: {
    color: "#fff",
    fontSize: 24,
  },
  fullscreenShare: {
    position: "absolute",
    bottom: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
});
