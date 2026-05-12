import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '../../../src/components/common/Avatar';
import { COLORS } from '../../../src/utils/constants';
import { useAuthStore } from '../../../src/store/authStore';
import { signOut } from '../../../src/services/auth';

const SettingRow = ({ icon, label, subtitle, onPress, destructive }: {
  icon: string; label: string; subtitle?: string; onPress?: () => void; destructive?: boolean;
}) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.settingIcon}>{icon}</Text>
    <View style={styles.settingInfo}>
      <Text style={[styles.settingLabel, destructive && styles.destructive]}>{label}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { userProfile, user } = useAuthStore();
  const displayName = userProfile?.displayName ?? userProfile?.username ?? 'User';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.header}>Settings</Text>

        {/* Profile Preview */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => user && router.push(`/profile/${user.uid}`)}
          activeOpacity={0.8}
        >
          <Avatar uri={userProfile?.photoURL} name={displayName} size="lg" />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileUsername}>@{userProfile?.username}</Text>
            <Text style={styles.profileAbout} numberOfLines={1}>{userProfile?.about || 'Tap to edit profile'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <SettingRow icon="🔑" label="Invite Keys" subtitle="Manage your invite links" onPress={() => router.push('/invite/keys')} />
          <SettingRow icon="🔍" label="Search Users" subtitle="Find people by username" onPress={() => router.push('/search')} />
        </View>

        <View style={styles.section}>
          <SettingRow icon="👤" label="Account" subtitle="Username, 2-step verification" onPress={() => router.push('/settings/account')} />
          <SettingRow icon="🔒" label="Privacy" subtitle="Last seen, blocked contacts" onPress={() => router.push('/settings/privacy')} />
          <SettingRow icon="🔔" label="Notifications" subtitle="Messages, calls, statuses" onPress={() => router.push('/settings/notifications')} />
          <SettingRow icon="💾" label="Storage & Data" subtitle="Network, storage usage" onPress={() => router.push('/settings/storage')} />
        </View>

        <View style={styles.section}>
          <SettingRow icon="🚪" label="Sign Out" onPress={handleSignOut} destructive />
        </View>

        <Text style={styles.version}>Purl v1.0.0 · End-to-end encrypted</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { fontSize: 24, fontWeight: '800', color: COLORS.text, padding: 16 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  profileUsername: { fontSize: 14, color: COLORS.primary, marginTop: 2 },
  profileAbout: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  settingIcon: { fontSize: 22, width: 30 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  settingSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  destructive: { color: COLORS.error },
  chevron: { fontSize: 20, color: COLORS.textMuted },
  version: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, paddingVertical: 20 },
});
