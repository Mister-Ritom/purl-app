import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useConversations } from '../../../src/hooks/useConversations';
import { useAuthStore } from '../../../src/store/authStore';
import { useChatStore } from '../../../src/store/chatStore';
import { UserListItem } from '../../../src/components/common/UserListItem';
import { EmptyState } from '../../../src/components/common/EmptyState';
import { COLORS } from '../../../src/utils/constants';
import { Conversation } from '../../../src/types/conversation';
import { decryptMessage, decryptWithGroupKey } from '../../../src/services/encryption';
import firestore from '@react-native-firebase/firestore';
import { UserProfile } from '../../../src/types/user';

export default function ChatListScreen() {
  const conversations = useConversations();
  const { user } = useAuthStore();
  const { getSharedSecretFromCache, getGroupKeyFromCache } = useChatStore();
  const [enrichedConvs, setEnrichedConvs] = useState<(Conversation & { otherUser?: UserProfile; preview: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
            const doc = await firestore().collection('users').doc(otherUid).get();
            if (doc.exists()) otherUser = { uid: otherUid, ...doc.data() } as UserProfile;
          }
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

  const renderItem = ({ item }: { item: typeof enrichedConvs[0] }) => {
    const displayName = item.isGroup
      ? item.groupName ?? 'Group'
      : item.otherUser?.displayName ?? item.otherUser?.username ?? 'Unknown';

    return (
      <UserListItem
        user={item.otherUser}
        title={displayName}
        subtitle={item.preview}
        timestamp={item.lastMessage?.timestamp}
        unreadCount={item.unreadCount}
        isOnline={item.otherUser?.isOnline}
        onPress={() => router.push(`/(app)/chats/${item.id}`)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => router.push('/search')}
        activeOpacity={0.8}
      >
        <Text style={styles.searchText}>🔍  Search users...</Text>
      </TouchableOpacity>

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
          data={enrichedConvs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }}
              tintColor={COLORS.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/invite/keys')}>
          <Text style={styles.fabIcon}>🔑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    margin: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchText: { color: COLORS.textMuted, fontSize: 15 },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 76 },
  fabContainer: { position: 'absolute', right: 20, bottom: 20 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: { fontSize: 24 },
});
