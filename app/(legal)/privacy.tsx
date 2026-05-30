import React from "react";
import { StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { FONTS, SIZES } from "../../src/utils/constants";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Custom Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} type="text">
            Privacy Policy
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View entering={FadeInDown.duration(600).springify()}>
            {/* Hero / Introduction Card */}
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + "1A" }]}>
                <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
              </View>
              <Text style={styles.heroTitle} type="text">
                Your Privacy is Absolute.
              </Text>
              <Text style={styles.heroSubtitle} type="textSecondary">
                Last updated: May 30, 2026
              </Text>
              <Text style={styles.heroText} type="textSecondary">
                Purl was built from the ground up to protect your communication. All of your messages, calls, and shared media are protected by End-to-End Encryption. We can never read your messages or listen to your calls.
              </Text>
            </View>

            {/* Section 1: End-to-End Encryption */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="key" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  1. End-to-End Encryption (E2EE)
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                All communications on Purl are fully encrypted using industry-standard cryptography (Curve25519, XSalsa20, Poly1305, and AES-GCM).
              </Text>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Device-Generated Keys
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Your encryption key pairs are generated on your device. Your private key is stored securely in your device's hardware-backed Keychain/Keystore and is never sent to our servers.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  No Server Access
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Because keys are stored locally, no one—including the Purl team, server providers, or third parties—can decrypt or read your messages, files, or call streams.
                </Text>
              </View>
            </View>

            {/* Section 2: Data We Collect */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="file-tray-full" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  2. Information We Collect
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                To provide a functional messaging experience, we collect minimal data:
              </Text>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Account Profile
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Your display name, about bio, and profile picture. This is visible to other users who add you as a contact.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Authentication
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  We use Firebase Authentication (Email, Phone number, or Google account) to secure your account and manage sessions.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  E2E Metadata
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  We store public identity keys on Firestore to allow other users to establish secure connections with you.
                </Text>
              </View>
            </View>

            {/* Section 3: Call & Message Delivery */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  3. Message & Call Delivery
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                - Messages and media attachments are uploaded to Cloud Storage and Firestore in their fully encrypted form.
                {"\n\n"}
                - Push notifications are routed through Apple Push Notification service (APNs) or Google Firebase Cloud Messaging (FCM). Notifications contain only encrypted payload headers to preserve privacy.
                {"\n\n"}
                - Real-time call signaling is powered by Agora. The voice/video stream itself is securely encrypted point-to-point and does not pass through storage databases.
              </Text>
            </View>

            {/* Section 4: Data Security and Local Storage */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="phone-portrait" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  4. Secure Local Storage
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                To guarantee security even if your device is compromised:
                {"\n\n"}
                - Chat messages are stored locally on your device in an encrypted MMKV database instance.
                {"\n\n"}
                - Secure storage elements (like your private identity keys) use AES-256-GCM encryption in hardware-protected storage enclaves (iOS Keychain / Android Keystore).
              </Text>
            </View>

            {/* Section 5: Data Deletion & Retention */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trash" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  5. Account & Data Deletion
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                You have full control over your data. At any time, you can choose to delete your account. Deleting your account will immediately wipe your user profile, public keys, and chat logs from our databases, and release your registered username. Local data will also be purged from your device.
              </Text>
            </View>

            {/* Section 6: Contact */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="mail" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  6. Contact Info
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                If you have any questions or feedback about our privacy practices, please contact us at:
                {"\n\n"}
                <Text type="primary" style={styles.emailText}>
                  privacy@purl.app
                </Text>
              </Text>
            </View>

            <View style={styles.footerSpacing} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    padding: 20,
  },
  heroCard: {
    borderRadius: SIZES.borderRadiusLg,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 28,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    textAlign: "center",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.mono,
    marginBottom: 16,
  },
  heroText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    textAlign: "center",
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  sectionText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    lineHeight: 22,
  },
  bulletItem: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
  },
  bulletTitle: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  emailText: {
    fontFamily: FONTS.medium,
    textDecorationLine: "underline",
  },
  footerSpacing: {
    height: 40,
  },
});
