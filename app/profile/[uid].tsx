import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/common/Avatar';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';
import { UserProfile } from '../../src/types/user';
import { findConversationBetween } from '../../src/services/firestore';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);

  const isOwnProfile = uid === user?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(getFirestore(), 'users', uid)).then((docSnap) => {
      if (docSnap.exists()) setProfile({ uid, ...docSnap.data() } as UserProfile);
      setLoading(false);
    });
  }, [uid]);

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

  if (loading) return <LoadingScreen />;
  if (!profile) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.notFound}><Text style={styles.notFoundText}>User not found</Text></View>
    </SafeAreaView>
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
          <View style={styles.aboutCard}>
            <Text style={styles.aboutLabel}>About</Text>
            <Text style={styles.aboutText}>{profile.about}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {!isOwnProfile ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleMessagePress} disabled={startingChat}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Voice Call', 'Feature coming soon')}>
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Video Call', 'Feature coming soon')}>
              <Text style={styles.actionIcon}>📹</Text>
              <Text style={styles.actionText}>Video</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/profile/edit')}>
            <Text style={styles.editProfileText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        )}

        {/* Shared Media placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Media</Text>
          <Text style={styles.sectionEmpty}>No shared media</Text>
        </View>

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
});
