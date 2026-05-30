import React, { useState, useEffect } from 'react';
import {
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { View, Text } from '../../../src/components/Themed';
import { useTheme } from '../../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '../../../src/components/common/Avatar';
import { useAuthStore } from '../../../src/store/authStore';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from '@react-native-firebase/firestore';
import { StatusItem } from '../../../src/types/status';
import { UserProfile } from '../../../src/types/user';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StatusRow({ children, onPress }: { children: React.ReactNode, onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));
  return (
    <AnimatedPressable
      style={[styles.statusRow, animatedStyle]}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

export default function StatusScreen() {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthStore();
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [contactStatuses, setContactStatuses] = useState<{ user: UserProfile; items: StatusItem[]; hasUnseen: boolean }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.header}>Updates</Text>

      {/* My Status */}
      <StatusRow
        onPress={() => myStatuses.length > 0 ? router.push(`/status/view/${user?.uid}` as any) : router.push('/status/create' as any)}
      >
        <View style={[styles.avatarRing, { borderColor: colors.border }, myStatuses.length > 0 && { borderColor: colors.primary }]}>
          <Avatar uri={userProfile?.photoURL} name={displayName} size="md" />
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.statusName}>My Status</Text>
          <Text style={styles.statusSub} type="textSecondary">
            {myStatuses.length > 0
              ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
              : 'Tap to add status update'}
          </Text>
        </View>
        <Pressable 
          style={[styles.addBtn, { backgroundColor: colors.primary }]} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/status/create' as any);
          }}
        >
          <Text style={styles.addBtnIcon}>+</Text>
        </Pressable>
      </StatusRow>

      <Text style={styles.sectionTitle} type="textSecondary">Recent updates</Text>

      {contactStatuses.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(600).springify().damping(20)} style={styles.empty}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={styles.emptyText} type="textSecondary">No recent updates right now.</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={contactStatuses}
          keyExtractor={(item) => item.user.uid}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.delay(index * 50).springify().damping(20)}>
              <StatusRow
                onPress={() => router.push(`/status/view/${item.user.uid}` as any)}
              >
                <View style={[styles.avatarRing, { borderColor: colors.border }, item.hasUnseen ? { borderColor: colors.primary } : { borderColor: colors.textMuted }]}>
                  <Avatar uri={item.user.photoURL} name={item.user.displayName} size="md" />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusName}>{item.user.displayName}</Text>
                  <Text style={styles.statusSub} type="textSecondary">{item.items.length} update{item.items.length > 1 ? 's' : ''}</Text>
                </View>
              </StatusRow>
            </Animated.View>
          )}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRefreshing(false);
              }} 
              tintColor={colors.primary} 
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 34, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, letterSpacing: -0.5 },
  avatarRing: { borderRadius: 32, borderWidth: 2, padding: 2 },
  statusInfo: { flex: 1 },
  statusName: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  statusSub: { fontSize: 15, marginTop: 2, fontFamily: 'Inter_400Regular' },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtnIcon: { fontSize: 20, color: '#fff', fontFamily: 'Inter_400Regular', lineHeight: 24 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 40, fontFamily: 'Inter_400Regular' },
});
