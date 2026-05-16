import React, { useState, useCallback, useEffect } from 'react';
import {
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getFirestore, collection, query, where, limit, getDocs } from '@react-native-firebase/firestore';
import { Avatar } from '../../src/components/common/Avatar';
import { EmptyState } from '../../src/components/common/EmptyState';
import { useTheme } from '../../src/hooks/useTheme';
import { UserProfile } from '../../src/types/user';

const DEBOUNCE = 300;

export default function SearchScreen() {
  const { colors } = useTheme();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [searchText, setSearchText] = useState(q || '');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) {
      performSearch(q);
    }
  }, [q]);

  const performSearch = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
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
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setResults(users);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search by username..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={(t) => {
              setSearchText(t);
              performSearch(t);
            }}
            autoFocus
            autoCapitalize="none"
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.userItem, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/profile/${item.uid}`)}
            >
              <Avatar uri={item.photoURL} name={item.displayName || item.username} size="md" />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName || item.username}</Text>
                <Text type="textSecondary" style={styles.userHandle}>@{item.username}</Text>
              </View>
              <Text type="textMuted">›</Text>
            </TouchableOpacity>
          )}
        />
      ) : searchText ? (
        <EmptyState 
          icon="🤷‍♂️" 
          title="No users found" 
          subtitle={`No one with username matching "${searchText}"`}
        />
      ) : (
        <EmptyState 
          icon="🔍" 
          title="Search Purl" 
          subtitle="Find your friends by their unique username"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 32, fontWeight: '300' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  clearIcon: { fontSize: 16, padding: 4 },
  loader: { marginTop: 40 },
  list: { padding: 16, gap: 12 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700' },
  userHandle: { fontSize: 14, marginTop: 2 },
});
