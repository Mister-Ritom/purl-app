import React, { useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { View, Text } from "../../src/components/Themed";
import { useTheme } from "../../src/hooks/useTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithPhone, confirmPhoneCode } from "../../src/services/auth";
import { router } from "expo-router";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/dist/Ionicons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const COUNTRIES = [
  { code: "US", name: "United States", callingCode: "1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", callingCode: "44", flag: "🇬🇧" },
  { code: "IN", name: "India", callingCode: "91", flag: "🇮🇳" },
  { code: "CA", name: "Canada", callingCode: "1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", callingCode: "61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", callingCode: "49", flag: "🇩🇪" },
  { code: "FR", name: "France", callingCode: "33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", callingCode: "39", flag: "🇮🇹" },
  { code: "JP", name: "Japan", callingCode: "81", flag: "🇯🇵" },
  { code: "CN", name: "China", callingCode: "86", flag: "🇨🇳" },
  { code: "BR", name: "Brazil", callingCode: "55", flag: "🇧🇷" },
  { code: "ZA", name: "South Africa", callingCode: "27", flag: "🇿🇦" },
  { code: "MX", name: "Mexico", callingCode: "52", flag: "🇲🇽" },
];

export default function PhoneScreen() {
  const { colors, isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const buttonScale = useSharedValue(1);

  const handleSendCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!phoneNumber) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Error", "Please enter a valid phone number.");
      return;
    }

    if (loading) return;
    setLoading(true);
    try {
      const fullPhoneNumber = `+${selectedCountry.callingCode}${phoneNumber}`;
      const conf = await signInWithPhone(fullPhoneNumber);
      setConfirmation(conf);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Failed to send code", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!code || !confirmation) return;

    if (loading) return;
    setLoading(true);
    try {
      await confirmPhoneCode(confirmation, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Verification failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const renderCountryItem = ({ item }: { item: (typeof COUNTRIES)[0] }) => (
    <TouchableOpacity
      style={[styles.countryItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        setSelectedCountry(item);
        setShowCountryPicker(false);
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={[styles.countryCallingCode, { color: colors.textMuted }]}>
        +{item.callingCode}
      </Text>
    </TouchableOpacity>
  );

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
              {confirmation ? "Verify Phone" : "Phone Sign In"}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150).duration(600).springify()}
            style={styles.form}
          >
            {!confirmation ? (
              <>
                <View style={styles.phoneInputContainer}>
                  <TouchableOpacity
                    style={[
                      styles.countryPickerContainer,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowCountryPicker(true);
                    }}
                  >
                    <Text style={styles.selectedCountryFlag}>
                      {selectedCountry.flag}
                    </Text>
                    <Text style={styles.selectedCallingCode}>
                      +{selectedCountry.callingCode}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      {
                        backgroundColor: colors.surface,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Phone Number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    returnKeyType="go"
                    onSubmitEditing={handleSendCode}
                  />
                </View>

                <AnimatedPressable
                  style={[
                    styles.submitButton,
                    { backgroundColor: colors.primary },
                    animatedButtonStyle,
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleSendCode}
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
                    <Text style={styles.submitButtonText}>Send Code</Text>
                  )}
                </AnimatedPressable>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  returnKeyType="go"
                  onSubmitEditing={handleVerifyCode}
                />
                <AnimatedPressable
                  style={[
                    styles.submitButton,
                    { backgroundColor: colors.primary },
                    animatedButtonStyle,
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleVerifyCode}
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
                    <Text style={styles.submitButtonText}>Verify Code</Text>
                  )}
                </AnimatedPressable>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setConfirmation(null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[styles.toggleButtonText, { color: colors.primary }]}
                  >
                    Edit Phone Number
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={renderCountryItem}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>
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
  phoneInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  countryPickerContainer: {
    borderWidth: 1,
    borderRadius: 16, // Squircle
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    gap: 8,
  },
  selectedCountryFlag: {
    fontSize: 24,
  },
  selectedCallingCode: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
  phoneInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderRadius: 16, // Squircle
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: "Inter_400Regular",
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 10,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "75%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalCloseText: {
    fontSize: 16,
    color: "#007AFF",
    fontFamily: "Inter_500Medium",
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  countryCallingCode: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
