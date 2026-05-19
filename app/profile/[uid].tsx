import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/common/Avatar';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';
import { UserProfile } from '../../src/types/user';
import { findConversationBetween } from '../../src/services/firestore';
import { getSharedSecret, decryptFile } from '../../src/services/encryption';
import { getCachedFilePath, isCached, getMimeTypeExtension } from '../../src/utils/mediaHelpers';
import { Message, MediaItem } from '../../src/types/message';
import { VideoMessage } from '../../src/components/chat/VideoMessage';

const downloadAndDecrypt = async (
  url: string,
  nonce: string,
  key: Uint8Array,
  cachePath: string
): Promise<string | null> => {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return null;

    const tempPath = `${cacheDir}shared_media_download_${Date.now()}_${Math.random().toString(36).substring(7)}.enc`;
    
    // Download the encrypted file
    const downloadResult = await FileSystem.downloadAsync(url, tempPath);
    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }
    
    const decryptedTempPath = `${cacheDir}shared_media_decrypted_${Date.now()}_${Math.random().toString(36).substring(7)}.dec`;
    const decryptedUri = await decryptFile(key, tempPath, nonce, decryptedTempPath);
    
    if (decryptedUri) {
      await FileSystem.moveAsync({ from: decryptedUri, to: cachePath });
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      return cachePath;
    }
    
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    return null;
  } catch (e) {
    console.error('[Profile:downloadAndDecrypt] failed:', e);
    return null;
  }
};

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { user, keyPair } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sharedMedia, setSharedMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isOwnProfile = uid === user?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(getFirestore(), 'users', uid)).then((docSnap) => {
      if (docSnap.exists()) setProfile({ uid, ...docSnap.data() } as UserProfile);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    if (!user || !profile || isOwnProfile) {
      setMediaLoading(false);
      return;
    }
    findConversationBetween(user.uid, profile.uid).then((convId) => {
      if (convId) {
        setConversationId(convId);
      } else {
        setMediaLoading(false);
      }
    });
  }, [user, profile, isOwnProfile]);

  useEffect(() => {
    if (!conversationId || !user || !profile || !keyPair) {
      return;
    }

    let activeKey: Uint8Array | null = null;
    if (profile.publicKey) {
      try {
        activeKey = getSharedSecret(keyPair.privateKey, profile.uid, profile.publicKey);
      } catch (e) {
        console.error('[Profile] Error computing shared secret:', e);
      }
    }

    if (!activeKey) {
      setMediaLoading(false);
      return;
    }

    const currentKey = activeKey;

    const q = query(
      collection(getFirestore(), 'conversations', conversationId, 'messages'),
      where('type', 'in', ['image', 'video', 'audio', 'document', 'media']),
      orderBy('timestamp', 'desc'),
      firestoreLimit(100)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot) {
        setMediaLoading(false);
        return;
      }

      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Message[];

      // Filter active, non-deleted messages (type filtering is now done on Firestore!)
      const mediaMsgs = msgs.filter((msg) => {
        const isDeleted = msg.deletedForEveryone || msg.deletedFor?.includes(user.uid);
        return !isDeleted;
      });

      const allMediaItems: MediaItem[] = [];

      for (const msg of mediaMsgs) {
        if (!msg.mediaItems) continue;
        for (let i = 0; i < msg.mediaItems.length; i++) {
          const item = msg.mediaItems[i];
          const ext = getMimeTypeExtension(item.mimeType);
          const cachePath = await getCachedFilePath(conversationId, msg.id + `_${i}`, ext);

          let localUri = item.localCacheUri;
          if (!localUri) {
            const cached = await isCached(cachePath);
            if (cached) {
              localUri = cachePath;
            } else {
              // Trigger asynchronous download & decryption
              downloadAndDecrypt(item.url, item.nonce, currentKey, cachePath).then((decryptedUri) => {
                if (decryptedUri) {
                  // Refresh state with the newly decrypted URI
                  setSharedMedia((prev) =>
                    prev.map((m) =>
                      m.url === item.url ? { ...m, localCacheUri: decryptedUri } : m
                    )
                  );
                }
              });
            }
          }

          allMediaItems.push({
            ...item,
            localCacheUri: localUri,
          });
        }
      }

      setSharedMedia(allMediaItems);
      setMediaLoading(false);
    }, (err) => {
      console.error('[Profile] Error loading shared media:', err);
      setMediaLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId, user, profile, keyPair]);

  const handleMessagePress = async () => {
    if (!user || !profile || startingChat) return;
    setStartingChat(true);
    try {
      const convId = await findConversationBetween(user.uid, profile.uid);
      if (convId) {
        router.push(`/chats/${convId}`);
      } else {
        // No existing conversation, ask for invite key
        Alert.alert(
          'Start Conversation',
          `You need an invite key to start a chat with @${profile.username}. Do you have one?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Enter Key', 
              onPress: () => router.push('/invite/scan') 
            }
          ]
        );
      }
    } catch (err) {
      console.error('Error finding conversation:', err);
      Alert.alert('Error', 'Could not open conversation.');
    } finally {
      setStartingChat(false);
    }
  };

  const shareMedia = async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.error('[ProfileScreen] Sharing failed:', e);
      Alert.alert('Error', 'Could not share this file.');
    }
  };

  const openDocument = async (uri: string, fileName?: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: undefined,
          dialogTitle: fileName || 'Open Document',
        });
      }
    } catch (e) {
      console.error('Error opening document:', e);
      Alert.alert('Error', 'Could not open the document.');
    }
  };

  if (loading) return <LoadingScreen />;
  if (!profile) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.notFound}><Text style={styles.notFoundText}>User not found</Text></View>
    </SafeAreaView>
  );

  const photosAndVideos = sharedMedia.filter(
    (m) => m.mimeType.startsWith('image/') || m.mimeType.startsWith('video/')
  );
  const documents = sharedMedia.filter(
    (m) =>
      !m.mimeType.startsWith('image/') &&
      !m.mimeType.startsWith('video/') &&
      !m.mimeType.startsWith('audio/')
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹ Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Avatar uri={profile.photoURL} name={profile.displayName} size="xl" online={profile.isOnline} />
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.isOnline ? (
              <View style={styles.onlineBadge}><Text style={styles.onlineBadgeText}>🟢 Online</Text></View>
            ) : (
              profile.lastSeen && <Text style={styles.lastSeen}>Last seen recently</Text>
            )}
          </View>

          {/* About */}
          {profile.about ? (
            <View style={[styles.aboutCard, { borderColor: colors.border }]}>
              <Text style={styles.aboutLabel}>About</Text>
              <Text style={styles.aboutText}>{profile.about}</Text>
            </View>
          ) : null}

          {/* Actions */}
          {!isOwnProfile ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={handleMessagePress} disabled={startingChat}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Voice Call', 'Feature coming soon')}>
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => Alert.alert('Video Call', 'Feature coming soon')}>
                <Text style={styles.actionIcon}>📹</Text>
                <Text style={styles.actionText}>Video</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.editProfileBtn, { borderColor: colors.border }]} onPress={() => router.push('/profile/edit')}>
              <Text style={styles.editProfileText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
          )}

          {/* Shared Media */}
          {!isOwnProfile && (
            <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={styles.sectionTitle}>Shared Media</Text>
              {mediaLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : sharedMedia.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: colors.textSecondary }]}>No shared media</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {photosAndVideos.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                        Photos & Videos ({photosAndVideos.length})
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {photosAndVideos.map((m, idx) => {
                          const isReady = !!m.localCacheUri;
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={styles.thumbnailContainer}
                              onPress={() => {
                                if (isReady) {
                                  if (m.mimeType.startsWith('image/')) {
                                    setSelectedImage(m.localCacheUri!);
                                  }
                                }
                              }}
                              disabled={!isReady}
                            >
                              {m.mimeType.startsWith('image/') ? (
                                <Image
                                  source={m.localCacheUri ?? m.url}
                                  style={[styles.thumbnail, !isReady && styles.blurredMedia]}
                                  contentFit="cover"
                                />
                              ) : (
                                <View style={styles.thumbnail}>
                                  {isReady ? (
                                    <VideoMessage
                                      uri={m.localCacheUri!}
                                      isOwn={false}
                                      style={styles.thumbnailVideo}
                                    />
                                  ) : (
                                    <View style={styles.videoPlaceholder}>
                                      <ActivityIndicator size="small" color="#fff" />
                                    </View>
                                  )}
                                </View>
                              )}
                              {!isReady && (
                                <View style={styles.loaderOverlay}>
                                  <ActivityIndicator size="small" color="#fff" />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {documents.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                        Documents ({documents.length})
                      </Text>
                      <View style={{ gap: 6 }}>
                        {documents.map((docItem, idx) => {
                          const isReady = !!docItem.localCacheUri;
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[styles.docRow, { borderColor: colors.border }]}
                              onPress={() => {
                                if (docItem.localCacheUri) {
                                  openDocument(docItem.localCacheUri, docItem.fileName || undefined);
                                }
                              }}
                              disabled={!isReady}
                            >
                              <Text style={styles.docIcon}>📄</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>
                                  {docItem.fileName || 'Document'}
                                </Text>
                                {!isReady ? (
                                  <Text style={[styles.decryptTextSmall, { color: colors.textSecondary }]}>Decrypting...</Text>
                                ) : (
                                  docItem.size && (
                                    <Text style={[styles.decryptTextSmall, { color: colors.textSecondary }]}>
                                      {Math.round(docItem.size / 1024)} KB
                                    </Text>
                                  )
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {!isOwnProfile && (
            <View style={styles.safetySection}>
              <TouchableOpacity onPress={() => Alert.alert('Blocked', 'User blocked.')}>
                <Text style={styles.blockText}>Block @{profile.username}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Reported', 'User reported.')}>
                <Text style={styles.reportText}>Report</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Image Fullscreen Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fullscreenShare}
            onPress={() => selectedImage && shareMedia(selectedImage)}
          >
            <Text style={styles.fullscreenCloseText}>⎙</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  backBtn: { marginBottom: 20 },
  backIcon: { fontSize: 17, fontWeight: '500' },
  header: { alignItems: 'center', gap: 8, marginBottom: 24 },
  displayName: { fontSize: 26, fontWeight: '800', marginTop: 12 },
  username: { fontSize: 15 },
  onlineBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  onlineBadgeText: { fontSize: 13, fontWeight: '600' },
  lastSeen: { fontSize: 13 },
  aboutCard: { borderRadius: 14, padding: 16, gap: 6, marginBottom: 20, borderWidth: 1 },
  aboutLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  aboutText: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 24, justifyContent: 'center' },
  actionBtn: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 16, gap: 6, borderWidth: 1 },
  actionIcon: { fontSize: 24 },
  actionText: { fontSize: 13, fontWeight: '600' },
  editProfileBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  editProfileText: { fontSize: 16, fontWeight: '600' },
  section: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sectionEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  safetySection: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 },
  blockText: { fontSize: 14, fontWeight: '600' },
  reportText: { fontSize: 14 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16 },
  thumbnailContainer: {
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailVideo: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    gap: 12,
  },
  docIcon: {
    fontSize: 22,
  },
  docName: {
    fontSize: 14,
    fontWeight: '500',
  },
  decryptTextSmall: {
    fontSize: 11,
    marginTop: 2,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    padding: 10,
  },
  fullscreenCloseText: {
    color: '#fff',
    fontSize: 24,
  },
  fullscreenShare: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    padding: 10,
  },
  blurredMedia: {
    opacity: 0.5,
  },
});
