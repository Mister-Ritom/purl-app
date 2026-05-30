import React, { useState, useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmail } from "../../src/services/auth";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/dist/Ionicons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function EmailScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const buttonScale = useSharedValue(1);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (loading) return;
    setLoading(true);
    try {
      await signInWithEmail(email, password, isSignUp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Authentication failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View
            entering={FadeInDown.duration(600).springify()}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              style={styles.backButton}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>
              {isSignUp ? "Create Account" : "Sign In"}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150).duration(600).springify()}
            style={styles.form}
          >
            {/* Apple Style Grouped Input */}
            <View
              style={[
                styles.inputGroup,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                ref={emailRef}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderBottomColor: colors.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
              <TextInput
                ref={passRef}
                style={[styles.input, { color: colors.text }]}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <AnimatedPressable
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                animatedButtonStyle,
                loading && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              onPressIn={() => {
                buttonScale.value = withSpring(0.96);
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1);
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isSignUp ? "Sign Up" : "Continue"}
                </Text>
              )}
            </AnimatedPressable>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                Haptics.selectionAsync();
                setIsSignUp(!isSignUp);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.toggleButtonText, { color: colors.primary }]}
              >
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
    marginLeft: -8,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    borderRadius: 16, // iOS grouped inset style
    borderWidth: 1,
    overflow: "hidden",
  },
  input: {
    height: 56,
    paddingHorizontal: 20,
    fontSize: 17,
    fontFamily: "Inter_400Regular",
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  toggleButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
