import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import { Avatar } from '../../src/components/common/Avatar';
import { EmptyState } from '../../src/components/common/EmptyState';
import { COLORS } from '../../src/utils/constants';
import { UserProfile } from '../../src/types/user';

const DEBOUNCE = 300;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const clean = q.toLowerCase().trim().replace('@', '');
      const snap = await firestore()
        .collection('users')
        .where('username', '>=', clean)
        .where('username', '<=', clean + '\uf8ff')
        .limit(20)
        .get();
      const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserProfile[];
      setResults(users);
      setSearching(false);
      setSearched(true);
    }, DEBOUNCE);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => { setQuery(t); doSearch(t); }}
          placeholder="Search by username..."
          placeholderTextColor={COLORS.textMuted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {searching ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : searched && results.length === 0 ? (
        <EmptyState icon="👀" title={`No user found for "@${query}"`} subtitle="Try a different username." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => u.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/profile/${item.uid}`)}
              activeOpacity={0.7}
            >
              <Avatar uri={item.photoURL} name={item.displayName} size="md" online={item.isOnline} />
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{item.displayName}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surfaceElevated, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 16, color: COLORS.text },
  clearBtn: { color: COLORS.textMuted, fontSize: 16, padding: 4 },
  loader: { marginTop: 40 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  userInfo: { flex: 1 },
  displayName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  username: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 20, color: COLORS.textMuted },
  sep: { height: 1, backgroundColor: COLORS.border, marginLeft: 78 },
});
