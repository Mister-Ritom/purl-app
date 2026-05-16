import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from '../../../src/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useConversations } from '../../../src/hooks/useConversations';
import { useAuthStore } from '../../../src/store/authStore';
import { useChatStore } from '../../../src/store/chatStore';
import { UserListItem } from '../../../src/components/common/UserListItem';
import { EmptyState } from '../../../src/components/common/EmptyState';
import { useTheme } from '../../../src/hooks/useTheme';
import { COLORS } from '../../../src/utils/constants';
import { Conversation } from '../../../src/types/conversation';
import { decryptMessage, decryptWithGroupKey } from '../../../src/services/encryption';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { UserProfile } from '../../../src/types/user';
import { StoryBar } from '../../../src/components/chat/StoryBar';
import { Image } from 'expo-image';

export default function ChatListScreen() {
  const { colors } = useTheme();
  const conversations = useConversations();
  const { user } = useAuthStore();
  const { getSharedSecretFromCache, getGroupKeyFromCache } = useChatStore();
  const [enrichedConvs, setEnrichedConvs] = useState<(Conversation & { otherUser?: UserProfile; preview: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    enrichConversations();
  }, [conversations]);

  async function enrichConversations() {
    if (!user) return;
    const result = await Promise.all(
      conversations.map(async (conv) => {
        let otherUser: UserProfile | undefined;
        if (!conv.isGroup) {
          const otherUid = conv.participants.find((p) => p !== user.uid);
          if (otherUid) {
            const userDocSnap = await getDoc(doc(getFirestore(), 'users', otherUid));
            if (userDocSnap.exists()) otherUser = { uid: otherUid, ...userDocSnap.data() } as UserProfile;
          }
        }

        if (otherUser?.photoURL) {
          Image.prefetch(otherUser.photoURL);
        }

        let preview = '';
        if (conv.lastMessage) {
          const { type, encryptedContent, nonce, senderId } = conv.lastMessage;
          const isOwn = senderId === user.uid;
          const prefix = isOwn ? 'You: ' : '';

          let decrypted: string | null = null;
          if (conv.isGroup) {
            const gKey = getGroupKeyFromCache(conv.id);
            if (gKey) decrypted = decryptWithGroupKey(gKey, encryptedContent, nonce);
          } else {
            const otherUid = conv.participants.find((p) => p !== user.uid);
            if (otherUid) {
              const secret = getSharedSecretFromCache(otherUid);
              if (secret) decrypted = decryptMessage(secret, encryptedContent, nonce);
            }
          }

          if (decrypted) {
            if (type === 'text') preview = `${prefix}${decrypted.slice(0, 40)}`;
            else if (type === 'media') preview = `${prefix}📷 ${decrypted === 'media' ? 'Media' : decrypted}`;
            else if (type === 'audio') preview = `${prefix}🎤 Voice message`;
            else if (type === 'document') preview = `${prefix}📄 ${decrypted}`;
            else preview = `${prefix}Attachment`;
          } else {
            preview = '🔒 Encrypted message';
          }
        }
        return { ...conv, otherUser, preview };
      })
    );
    setEnrichedConvs(result);
  }

  const filteredConvs = React.useMemo(() => {
    if (!searchText.trim()) return enrichedConvs;
    const lower = searchText.toLowerCase();
    return enrichedConvs.filter(conv => {
      const name = conv.isGroup 
        ? conv.groupName 
        : (conv.otherUser?.displayName || conv.otherUser?.username);
      return name?.toLowerCase().includes(lower);
    });
  }, [enrichedConvs, searchText]);

  const renderItem = ({ item }: { item: typeof enrichedConvs[0] }) => {
    const displayName = item.isGroup
      ? item.groupName ?? 'Group'
      : item.otherUser?.displayName ?? item.otherUser?.username ?? 'Unknown';
    const unreadCount = item.unreadCounts?.[user?.uid ?? ''] ?? 0;

    return (
      <UserListItem
        user={item.otherUser}
        avatarUri={item.isGroup ? item.groupPhotoUrl : undefined}
        title={displayName}
        subtitle={item.preview}
        timestamp={item.lastMessage?.timestamp}
        unreadCount={unreadCount}
        onPress={() => router.push(`/chats/${item.id}`)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity 
          style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => router.push('/contacts')}
          activeOpacity={0.9}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
            Search chats, contacts or global...
          </Text>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <EmptyState
          icon="🔑"
          title="No chats yet"
          subtitle="Share your invite key to connect with people and start encrypted conversations."
          actionLabel="Manage Invite Keys"
          onAction={() => router.push('/invite/keys')}
        />
      ) : (
        <FlatList
          data={filteredConvs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={<StoryBar />}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={() => router.push('/invite/keys')}>
          <Text style={styles.fabIcon}>🔑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 16 },
  placeholderText: {
    flex: 1,
    fontSize: 16,
  },
  searchText: { fontSize: 15 },
  separator: { height: 1, marginLeft: 76 },
  fabContainer: { position: 'absolute', right: 20, bottom: 90 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: { fontSize: 24 },
});
