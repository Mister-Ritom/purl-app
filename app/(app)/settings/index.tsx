import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../../src/components/Themed";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Avatar } from "../../../src/components/common/Avatar";
import { useAuthStore } from "../../../src/store/authStore";
import { useTheme } from "../../../src/hooks/useTheme";
import { signOut } from "../../../src/services/auth";

const SettingRow = ({
  icon,
  label,
  subtitle,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={styles.settingIcon}>{icon}</Text>
    <View style={styles.settingContent}>
      <Text style={[styles.settingLabel, destructive && { color: "#ef4444" }]}>
        {label}
      </Text>
      {subtitle && (
        <Text type="textSecondary" style={styles.settingSubtitle}>
          {subtitle}
        </Text>
      )}
    </View>
    <Text type="textMuted" style={styles.settingArrow}>
      ›
    </Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { user, userProfile } = useAuthStore();
  const { colors } = useTheme();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/welcome");
          } catch (err) {
            Alert.alert("Error", "Failed to log out");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.surface }]}
          onPress={() => router.push("/profile/edit")}
        >
          <Avatar
            uri={user?.photoURL}
            name={userProfile?.displayName || userProfile?.username}
            size="lg"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {userProfile?.displayName || userProfile?.username || "Purl User"}
            </Text>
            <Text type="textSecondary" style={styles.profileEmail}>
              {user?.email}
            </Text>
          </View>
          <Text type="textMuted">Edit ›</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text type="textMuted" style={styles.sectionTitle}>
            Account
          </Text>
          <View
            style={[styles.sectionContent, { backgroundColor: colors.surface }]}
          >
            <SettingRow
              icon="👤"
              label="Edit Profile"
              onPress={() => router.push("/profile/edit")}
            />
            <SettingRow
              icon="🔑"
              label="Privacy & Security"
              onPress={() => router.push("/settings/privacy")}
            />
            <SettingRow
              icon="🔔"
              label="Notifications"
              onPress={() => router.push("/settings/notifications")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text type="textMuted" style={styles.sectionTitle}>
            App
          </Text>
          <View
            style={[styles.sectionContent, { backgroundColor: colors.surface }]}
          >
            <SettingRow
              icon="☁️"
              label="Storage & Data"
              onPress={() => router.push("/settings/storage")}
            />
            <SettingRow icon="❓" label="Help & Support" />
            <SettingRow icon="ℹ️" label="About Purl" />
          </View>
        </View>

        <View style={styles.section}>
          <View
            style={[styles.sectionContent, { backgroundColor: colors.surface }]}
          >
            <SettingRow
              icon="🚪"
              label="Logout"
              onPress={handleLogout}
              destructive
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { padding: 24 },
  title: { fontSize: 34, fontWeight: "800" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 20, fontWeight: "700" },
  profileEmail: { fontSize: 14, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginLeft: 36,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  sectionContent: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingIcon: { fontSize: 22, width: 32 },
  settingContent: { flex: 1, marginLeft: 8 },
  settingLabel: { fontSize: 17, fontWeight: "500" },
  settingSubtitle: { fontSize: 13, marginTop: 2 },
  settingArrow: { fontSize: 20, marginLeft: 8 },
});
