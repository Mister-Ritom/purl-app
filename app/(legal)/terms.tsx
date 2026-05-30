import React from "react";
import { StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { FONTS, SIZES } from "../../src/utils/constants";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function TermsOfServiceScreen() {
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
            Terms of Service
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View entering={FadeInDown.duration(600).springify()}>
            {/* Hero / Overview Card */}
            <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + "1A" }]}>
                <Ionicons name="document-text" size={32} color={colors.primary} />
              </View>
              <Text style={styles.heroTitle} type="text">
                Agreement to Terms
              </Text>
              <Text style={styles.heroSubtitle} type="textSecondary">
                Last updated: May 30, 2026
              </Text>
              <Text style={styles.heroText} type="textSecondary">
                Please read these terms carefully before using Purl. By continuing to use our service, you agree to be bound by these terms. If you do not agree to all terms, you may not access or use the application.
              </Text>
            </View>

            {/* Section 1: Account & Key Ownership */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-circle" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  1. Account & Security Keys
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                Purl uses cryptographic identity keys to secure your chats.
              </Text>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Your Responsibility
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Your private keys are stored only on your local device. If you lose access to your device or delete the app, Purl cannot restore your old chat history or recover your keys, as we do not have copies.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Username Rights
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  We reserve the right to reclaim usernames if they are inactive for extended periods, violate trademarks, or are offensive.
                </Text>
              </View>
            </View>

            {/* Section 2: Acceptable Use */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="alert-circle" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  2. Acceptable Use
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                You agree not to use Purl to:
              </Text>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Violate Laws
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Transmit or share any content that is illegal, defamatory, threatening, or violates intellectual property.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Abuse or Spam
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Send unsolicited messages (spam), harass other users, or attempt to gather information from users through phishing.
                </Text>
              </View>
              <View style={[styles.bulletItem, { borderLeftColor: colors.primary }]}>
                <Text style={styles.bulletTitle} type="text">
                  Exploit the Network
                </Text>
                <Text style={styles.bulletText} type="textSecondary">
                  Disrupt the Purl infrastructure, upload malware, reverse engineer the communication protocols, or run denial-of-service attacks.
                </Text>
              </View>
            </View>

            {/* Section 3: End-to-End Encryption Limitations */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="lock-closed" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  3. End-to-End Encryption
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                While Purl provides advanced End-to-End Encryption (E2EE) to secure your communications, encryption only protects data in transit. You must maintain the physical security of your device. Purl is not responsible if a third party gains unauthorized access to your unlocked device.
              </Text>
            </View>

            {/* Section 4: Service Modifications & Downtime */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="refresh-circle" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  4. Service Updates
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                We continuously improve Purl and may release updates, add features, or periodically experience temporary downtime. We do not guarantee continuous, uninterrupted availability of our cloud servers or Agora calling relays.
              </Text>
            </View>

            {/* Section 5: Disclaimers & Warranties */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  5. Disclaimers & "As-Is"
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                Purl is provided "AS IS" and "AS AVAILABLE" without any warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, security, or non-infringement.
              </Text>
            </View>

            {/* Section 6: Limitation of Liability */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="ban" size={20} color={colors.primary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle} type="text">
                  6. Limitation of Liability
                </Text>
              </View>
              <Text style={styles.sectionText} type="textSecondary">
                To the maximum extent permitted by law, Purl, its developers, and contributors shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the service, including data loss, loss of messages, or security breaches.
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
  footerSpacing: {
    height: 40,
  },
});
