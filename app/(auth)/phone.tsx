import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithPhone, confirmPhoneCode } from '../../src/services/auth';
import { router } from 'expo-router';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

const COUNTRIES = [
  { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧' },
  { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳' },
  { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', callingCode: '49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', callingCode: '33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', callingCode: '39', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', callingCode: '81', flag: '🇯🇵' },
  { code: 'CN', name: 'China', callingCode: '86', flag: '🇨🇳' },
  { code: 'BR', name: 'Brazil', callingCode: '55', flag: '🇧🇷' },
  { code: 'ZA', name: 'South Africa', callingCode: '27', flag: '🇿🇦' },
  { code: 'MX', name: 'Mexico', callingCode: '52', flag: '🇲🇽' },
];

export default function PhoneScreen() {
  const { colors, isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    if (loading) return;
    setLoading(true);
    try {
      const fullPhoneNumber = `+${selectedCountry.callingCode}${phoneNumber}`;
      const conf = await signInWithPhone(fullPhoneNumber);
      setConfirmation(conf);
    } catch (err: any) {
      Alert.alert('Failed to send code', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || !confirmation) return;

    if (loading) return;
    setLoading(true);
    try {
      await confirmPhoneCode(confirmation, code);
    } catch (err: any) {
      Alert.alert('Verification failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderCountryItem = ({ item }: { item: typeof COUNTRIES[0] }) => (
    <TouchableOpacity
      style={[styles.countryItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        setSelectedCountry(item);
        setShowCountryPicker(false);
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={[styles.countryCallingCode, { color: colors.textMuted }]}>+{item.callingCode}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0A0F', '#12104A', '#0A0A0F'] : ['#F8FAFC', '#EEF2FF', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{confirmation ? 'Verify Phone' : 'Phone Sign In'}</Text>
          </View>

          <View style={styles.form}>
            {!confirmation ? (
              <>
                <View style={styles.phoneInputContainer}>
                  <TouchableOpacity
                    style={[styles.countryPickerContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    onPress={() => setShowCountryPicker(true)}
                  >
                    <Text style={styles.selectedCountryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.selectedCallingCode}>+{selectedCountry.callingCode}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.phoneInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    placeholder="Phone Number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
                  onPress={handleSendCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Send Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setConfirmation(null)}
                >
                  <Text style={[styles.toggleButtonText, { color: colors.primary }]}>
                    Edit Phone Number
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showCountryPicker} animationType="slide" transparent={true}>
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
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
    paddingHorizontal: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 40,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  form: {
    gap: 16,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  countryPickerContainer: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    gap: 8,
  },
  selectedCountryFlag: {
    fontSize: 24,
  },
  selectedCallingCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 8,
  },
  submitButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  countryCallingCode: {
    fontSize: 16,
    fontWeight: '500',
  },
});
