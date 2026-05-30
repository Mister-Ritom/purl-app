import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { signInWithGoogle } from "../../src/services/auth";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { SIZES, FONTS } from "../../src/utils/constants";

const { width: screenWidth } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScaleButton({
  onPress,
  disabled,
  loading,
  children,
  style,
  isPrimary = false,
}: any) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.96, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || loading}
      style={[style, animatedStyle, (disabled || loading) && { opacity: 0.7 }]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#000" : "#FFF"} />
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}

export default function WelcomeScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign-in failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / screenWidth);
    if (pageIndex !== activeSlide) {
      setActiveSlide(pageIndex);
      Haptics.selectionAsync();
    }
  };

  const slides = [
    {
      title: "End-to-End Encrypted",
      description:
        "Your messages, voice calls, and video streams are completely private. Not even Purl can read them.",
      image: require("../../assets/security_illustration.png"),
    },
    {
      title: "Invite-Only Connections",
      description:
        "Connect securely via QR codes and direct invites. No spam, no unsolicited contact, just the people you trust.",
      image: require("../../assets/network_illustration.png"),
    },
    {
      title: "Crystal-Clear Calling",
      description:
        "Experience secure, low-latency voice and video calls powered by state-of-the-art WebRTC technology.",
      image: require("../../assets/calling_illustration.png"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? ["#000000", "#0D0D18", "#121020", "#000000"]
            : ["#FFFFFF", "#F4F6FF", "#E9ECFF", "#FFFFFF"]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea}>
        {/* App Title & Header */}
        <Animated.View
          entering={FadeInDown.duration(800).springify()}
          style={styles.header}
        >
          <Image
            source={require("../../assets/splash-icon.png")}
            style={styles.logo}
          />
          <Text type="text" style={styles.appName}>
            Purl
          </Text>
        </Animated.View>

        {/* Onboarding Pages ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.slider}
        >
          {slides.map((slide, index) => (
            <View key={index} style={styles.slideWidthWrapper}>
              <View style={styles.slide}>
                <Animated.View
                  entering={FadeInDown.delay(100).duration(800).springify()}
                  style={styles.imageContainer}
                >
                  <Image
                    source={slide.image}
                    style={styles.slideImage}
                    transition={300}
                    contentFit="contain"
                  />
                </Animated.View>
                <Animated.View
                  entering={FadeInDown.delay(300).duration(800).springify()}
                  style={styles.textContainer}
                >
                  <Text type="text" style={styles.slideTitle}>
                    {slide.title}
                  </Text>
                  <Text type="textSecondary" style={styles.slideDescription}>
                    {slide.description}
                  </Text>
                </Animated.View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const isActive = index === activeSlide;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : isDark
                        ? "#38383A"
                        : "#E5E5EA",
                    width: isActive ? 20 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Auth Group Panel */}
        <Animated.View
          entering={FadeIn.delay(500).duration(800)}
          style={styles.footer}
        >
          {/* Continue with Google (Primary Option) */}
          <ScaleButton
            style={[
              styles.googleButton,
              {
                backgroundColor: isDark ? "#FFFFFF" : "#000000",
                shadowColor: isDark ? "#5E5CE6" : "#4F46E5",
              },
            ]}
            onPress={handleGoogleSignIn}
            loading={loading}
            isPrimary={true}
          >
            <Ionicons
              name="logo-google"
              size={18}
              color={isDark ? "#000000" : "#FFFFFF"}
              style={styles.btnIcon}
            />
            <Text
              style={[
                styles.googleButtonText,
                { color: isDark ? "#000000" : "#FFFFFF" },
              ]}
            >
              Continue with Google
            </Text>
          </ScaleButton>

          {/* Secondary Auth: Email and Phone in a Row */}
          <View style={styles.secondaryRow}>
            {/* Email */}
            <ScaleButton
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.push("/(auth)/email")}
              disabled={loading}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.text}
                style={styles.btnIcon}
              />
              <Text type="text" style={styles.secondaryButtonText}>
                Email
              </Text>
            </ScaleButton>

            {/* Phone */}
            <ScaleButton
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.push("/(auth)/phone")}
              disabled={loading}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color={colors.text}
                style={styles.btnIcon}
              />
              <Text type="text" style={styles.secondaryButtonText}>
                Phone
              </Text>
            </ScaleButton>
          </View>

          {/* Legal Footer Links */}
          <Text type="textMuted" style={styles.legal}>
            By continuing, you agree to our{" "}
            <Text
              type="primary"
              style={styles.legalLink}
              onPress={() => router.push("/(legal)/terms")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              type="primary"
              style={styles.legalLink}
              onPress={() => router.push("/(legal)/privacy")}
            >
              Privacy Policy
            </Text>
          </Text>
        </Animated.View>
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
    justifyContent: "center",
    paddingTop: 16,
    gap: 10,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  appName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  slider: {
    flex: 1,
    marginTop: 10,
  },
  slideWidthWrapper: {
    width: screenWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    width: screenWidth - 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  imageContainer: {
    width: screenWidth * 0.72,
    height: screenWidth * 0.72,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  slideTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  slideDescription: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 18,
    gap: 6,
    backgroundColor: "transparent",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 12,
    backgroundColor: "transparent",
  },
  googleButton: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "transparent",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  legal: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  legalLink: {
    textDecorationLine: "underline",
  },
});
