import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '../../../src/components/common/Avatar';
import { COLORS } from '../../../src/utils/constants';
import { useAuthStore } from '../../../src/store/authStore';
import { getFirestore, collection, doc, query, where, orderBy, onSnapshot } from '@react-native-firebase/firestore';
import { StatusItem } from '../../../src/types/status';
import { UserProfile } from '../../../src/types/user';

export default function StatusScreen() {
  const { user, userProfile } = useAuthStore();
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [contactStatuses, setContactStatuses] = useState<{ user: UserProfile; items: StatusItem[]; hasUnseen: boolean }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load my statuses
    const q = query(
      collection(getFirestore(), 'statuses', user.uid, 'items'),
      where('expiresAt', '>', new Date()),
      orderBy('expiresAt', 'asc')
    );

    const myUnsub = onSnapshot(q, (snap) => {
      if (!snap || !snap.docs) {
        setMyStatuses([]);
        return;
      }
      setMyStatuses(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StatusItem[]);
    });
    return () => myUnsub();
  }, [user]);

  const displayName = userProfile?.displayName ?? userProfile?.username ?? 'You';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Status</Text>

      {/* My Status */}
      <TouchableOpacity
        style={styles.myStatusRow}
        onPress={() => myStatuses.length > 0 ? router.push(`/status/view/${user?.uid}` as any) : router.push('/status/create' as any)}
      >
        <View style={[styles.avatarRing, myStatuses.length > 0 && styles.avatarRingActive]}>
          <Avatar uri={userProfile?.photoURL} name={displayName} size="md" />
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusName}>My Status</Text>
          <Text style={styles.statusSub}>
            {myStatuses.length > 0
              ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
              : 'Tap to add status update'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/status/create' as any)}>
          <Text style={styles.addBtnIcon}>+</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Recent Updates</Text>

      {contactStatuses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⭕</Text>
          <Text style={styles.emptyText}>No status updates from contacts yet.</Text>
        </View>
      ) : (
        <FlatList
          data={contactStatuses}
          keyExtractor={(item) => item.user.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.statusRow}
              onPress={() => router.push(`/status/view/${item.user.uid}` as any)}
            >
              <View style={[styles.avatarRing, item.hasUnseen ? styles.avatarRingActive : styles.avatarRingSeen]}>
                <Avatar uri={item.user.photoURL} name={item.user.displayName} size="md" />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusName}>{item.user.displayName}</Text>
                <Text style={styles.statusSub}>{item.items.length} update{item.items.length > 1 ? 's' : ''}</Text>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={COLORS.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { fontSize: 24, fontWeight: '800', color: COLORS.text, padding: 16, paddingBottom: 8 },
  myStatusRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  avatarRing: { borderRadius: 30, borderWidth: 2, borderColor: COLORS.border, padding: 2 },
  avatarRingActive: { borderColor: COLORS.primary },
  avatarRingSeen: { borderColor: COLORS.textMuted },
  statusInfo: { flex: 1 },
  statusName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  statusSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnIcon: { fontSize: 20, color: '#fff', fontWeight: '300', lineHeight: 24 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, paddingHorizontal: 16, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
