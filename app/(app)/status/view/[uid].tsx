import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { COLORS } from '../../../../src/utils/constants';
import { getFirestore, collection, doc, query, where, orderBy, onSnapshot, getDoc } from '@react-native-firebase/firestore';
import { Avatar } from '../../../../src/components/common/Avatar';

const { width, height } = Dimensions.get('window');

export default function StatusViewScreen() {
  const { uid } = useLocalSearchParams();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!uid) return;

    // Fetch user profile
    getDoc(doc(getFirestore(), 'users', uid as string)).then(docSnap => {
      setUserProfile(docSnap.data());
    });

    // Fetch statuses
    const now = new Date();
    const q = query(
      collection(getFirestore(), 'statuses', uid as string, 'items'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    );

    const unsub = onSnapshot(q, snap => {
      if (snap) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setStatuses(list);
        if (list.length === 0) router.back();
      }
    });

    return unsub;
  }, [uid]);

  const nextStatus = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const prevStatus = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (statuses.length === 0) return null;

  const current = statuses[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressBarContainer}>
        {statuses.map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.progressBar, 
              { flex: 1, backgroundColor: i <= currentIndex ? COLORS.primary : 'rgba(255,255,255,0.3)' }
            ]} 
          />
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar uri={userProfile?.photoURL} name={userProfile?.displayName} size="sm" />
          <Text style={styles.username}>{userProfile?.displayName}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {current.type === 'text' ? (
          <Text style={styles.statusText}>{current.content}</Text>
        ) : (
          <Image source={{ uri: current.content }} style={styles.image} resizeMode="contain" />
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlSide} onPress={prevStatus} />
        <TouchableOpacity style={styles.controlSide} onPress={nextStatus} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressBarContainer: { flexDirection: 'row', paddingHorizontal: 10, gap: 4, marginTop: 10 },
  progressBar: { height: 2, borderRadius: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { color: '#fff', fontWeight: '600', fontSize: 16 },
  close: { color: '#fff', fontSize: 24, padding: 4 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  statusText: { color: '#fff', fontSize: 28, textAlign: 'center', fontWeight: '600' },
  image: { width: width, height: height * 0.7 },
  controls: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  controlSide: { flex: 1 },
});
