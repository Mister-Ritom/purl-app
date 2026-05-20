import React, { useState, useEffect, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from 'react-native-vector-icons/dist/Ionicons';
import { useAuthStore } from '../../src/store/authStore';
import { useConversations } from '../../src/hooks/useConversations';
import { UserListItem } from '../../src/components/common/UserListItem';
import { EmptyState } from '../../src/components/common/EmptyState';
import { useTheme } from '../../src/hooks/useTheme';
import { fetchUserProfile } from '../../src/services/firestore';
import { UserProfile } from '../../src/types/user';
import { Conversation } from '../../src/types/conversation';
import { getFirestore, collection, query, where, limit, getDocs } from '@react-native-firebase/firestore';

const DEBOUNCE = 500;

export default function ContactsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const conversations = useConversations();
  
  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchScope, setSearchScope] = useState<'chats' | 'local' | 'global'>('chats');
  const [globalResults, setGlobalResults] = useState<UserProfile[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadContacts() {
      if (!user) return;
      try {
        const uids = new Set<string>();
        conversations.forEach(c => {
          if (!c.isGroup) {
            c.participants.forEach(p => {
              if (p !== user.uid) uids.add(p);
            });
          }
        });

        const profiles = await Promise.all(
          Array.from(uids).map(uid => fetchUserProfile(uid))
        );
        setContacts(profiles.filter((p): p is UserProfile => p !== null));
      } catch (err) {
        console.error('Error loading contacts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadContacts();
  }, [conversations, user]);

  const enrichedConversations = useMemo(() => {
    return conversations.map(c => {
      if (c.isGroup) return c;
      const otherUserId = c.participants.find(p => p !== user?.uid);
      const otherUser = contacts.find(u => u.uid === otherUserId);
      return { ...c, otherUser };
    });
  }, [conversations, contacts, user]);

  const filteredResults = useMemo(() => {
    if (searchScope === 'global') return globalResults;
    
    if (searchScope === 'chats') {
      if (!searchText.trim()) return enrichedConversations;
      const lower = searchText.toLowerCase();
      return enrichedConversations.filter(c => 
        c.isGroup 
          ? c.groupName?.toLowerCase().includes(lower)
          : (c.otherUser?.displayName?.toLowerCase().includes(lower) || 
             c.otherUser?.username?.toLowerCase().includes(lower) ||
             c.participants.some(p => p.toLowerCase().includes(lower)))
      );
    }

    if (!searchText.trim()) return contacts;
    const lower = searchText.toLowerCase();
    return contacts.filter(c => 
      c.displayName?.toLowerCase().includes(lower) || 
      c.username?.toLowerCase().includes(lower)
    );
  }, [contacts, searchText, searchScope, globalResults, enrichedConversations]);

  useEffect(() => {
    if (searchScope === 'global' && searchText.trim()) {
      const timer = setTimeout(() => performGlobalSearch(searchText), DEBOUNCE);
      return () => clearTimeout(timer);
    } else {
      setGlobalResults([]);
    }
  }, [searchText, searchScope]);

  const performGlobalSearch = async (text: string) => {
    if (!text.trim()) return;
    setIsSearchingGlobal(true);
    try {
      const db = getFirestore();
      const lowerText = text.toLowerCase();
      const q = query(
        collection(db, 'users'),
        where('username', '>=', lowerText),
        where('username', '<=', lowerText + '\uf8ff'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      setGlobalResults(snapshot.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      console.error('Global search error:', err);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Contacts</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={
              searchScope === 'chats' ? "Search active chats..." :
              searchScope === 'local' ? "Search contacts..." : 
              "Search Purl global..."
            }
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
          
          {isSearchingGlobal && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          )}

          <TouchableOpacity 
            style={[styles.scopeSelector, { backgroundColor: colors.surface }]}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Text style={[styles.scopeText, { color: colors.primary }]}>
              {searchScope === 'chats' ? 'Chats' : 
               searchScope === 'local' ? 'Contacts' : 'Global'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.actionRow, { borderBottomColor: colors.border }]}
        onPress={() => router.push('/group/create')}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="people" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.actionText, { color: colors.primary }]}>New Group</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList<Conversation | UserProfile>
          data={filteredResults}
          keyExtractor={(item, index) => 'id' in item ? item.id : item.uid || index.toString()}
          renderItem={({ item }) => {
            if ('id' in item && 'participants' in item) {
              // It's a conversation
              const otherUserId = item.participants?.find(p => p !== user?.uid);
              const otherUser = item.otherUser;
              return (
                <UserListItem
                  title={item.isGroup ? item.groupName : undefined}
                  user={!item.isGroup ? (otherUser || { uid: otherUserId } as any) : undefined}
                  subtitle={
                    item.lastMessage?.type === 'text' ? 'Encrypted message' :
                    item.lastMessage?.type === 'image' ? '📷 Image' :
                    item.lastMessage?.type === 'video' ? '🎥 Video' :
                    item.lastMessage?.type === 'audio' ? '🎤 Audio message' :
                    item.lastMessage?.type === 'document' ? '📁 Document' :
                    item.lastMessage?.type === 'location' ? '📍 Location' :
                    item.lastMessage?.type === 'media' ? '🖼️ Media' :
                    item.lastMessage ? 'Message' : undefined
                  }
                  onPress={() => router.push(`/chats/${item.id}`)}
                />
              );
            }
            return (
              <UserListItem
                user={item}
                onPress={() => router.push(`/profile/${item.uid}`)}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                icon={searchText ? "🕵️‍♂️" : (searchScope === 'chats' ? "💬" : searchScope === 'global' ? "🌍" : "👥")}
                title={searchText ? `No results in ${searchScope}` : (searchScope === 'chats' ? "Search Chats" : searchScope === 'global' ? "Global Search" : "No contacts yet")}
                subtitle={searchText 
                  ? (searchScope === 'chats' ? "Try searching your contacts or global." : searchScope === 'local' ? "Try switching to Global search." : "No one found on Purl.")
                  : (searchScope === 'chats' ? "Find your active conversations." : searchScope === 'global' ? "Search for anyone on Purl." : "Start chatting to see people here.")}
              />
              {searchText && (searchScope === 'chats' || searchScope === 'local') && (
                <TouchableOpacity 
                  style={[styles.globalSearchBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setSearchScope(searchScope === 'chats' ? 'local' : 'global')}
                >
                  <Text style={styles.globalSearchBtnText}>
                    Switch to {searchScope === 'chats' ? 'Contacts' : 'Global'} Search
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}
      {isDropdownOpen && (
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[
              { label: 'Chats', value: 'chats' as const, icon: 'chatbubbles-outline' },
              { label: 'Contacts', value: 'local' as const, icon: 'people-outline' },
              { label: 'Global', value: 'global' as const, icon: 'globe-outline' }
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setSearchScope(option.value);
                  setIsDropdownOpen(false);
                }}
              >
                <View style={styles.dropdownItemContent}>
                  <Ionicons 
                    name={option.icon as any} 
                    size={18} 
                    color={searchScope === option.value ? colors.primary : colors.text} 
                  />
                  <Text style={[
                    styles.dropdownItemText, 
                    { color: searchScope === option.value ? colors.primary : colors.text },
                    searchScope === option.value && { fontWeight: '700' }
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {searchScope === option.value && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  scopeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  scopeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: { flex: 1, fontSize: 16, height: '100%' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: { fontSize: 16, fontWeight: '700' },
  list: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  globalSearchBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  globalSearchBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 110, // Adjusted to sit right below the search bar
    right: 16,
    width: 200,
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1001,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
