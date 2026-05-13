import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { checkUsernameAvailable } from '../../src/services/firestore';
import { completeOnboarding } from '../../src/services/auth';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/utils/constants';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const DEBOUNCE_MS = 500;

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function UsernameScreen() {
  const user = useAuthStore((s) => s.user);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!username) { setCheckState('idle'); return; }
    if (!USERNAME_REGEX.test(username)) { setCheckState('invalid'); return; }

    setCheckState('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setCheckState(available ? 'available' : 'taken');
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const handleSubmit = async () => {
    if (checkState !== 'available' || !user || submitting) return;
    if (!displayName.trim()) { Alert.alert('Name required', 'Enter your display name.'); return; }

    setSubmitting(true);
    try {
      await completeOnboarding(user.uid, username, displayName.trim());
      const docSnap = await getDoc(doc(getFirestore(), 'users', user.uid));
      setUserProfile(docSnap.data() as any);
      router.replace('/(app)/chats');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to claim username. Try another.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = {
    idle: '',
    checking: '⏳',
    available: '✅',
    taken: '❌',
    invalid: '⚠️',
  }[checkState];

  const statusText = {
    idle: '',
    checking: 'Checking availability...',
    available: 'Username available!',
    taken: 'Username already taken',
    invalid: '3–30 chars, letters, numbers and underscores only',
  }[checkState];

  const statusColor = {
    idle: COLORS.textMuted,
    checking: COLORS.textSecondary,
    available: COLORS.success,
    taken: COLORS.error,
    invalid: COLORS.warning,
  }[checkState];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Pick your username</Text>
          <Text style={styles.subtitle}>
            This is your unique identifier on Purl. You can change it later.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_username"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
              {checkState === 'checking' && (
                <ActivityIndicator size="small" color={COLORS.primary} />
              )}
              {checkState !== 'checking' && statusIcon ? (
                <Text style={styles.statusIcon}>{statusIcon}</Text>
              ) : null}
            </View>
            {statusText ? (
              <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            ) : null}
          </View>

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Username rules:</Text>
            {[
              '3 to 30 characters',
              'Letters (a–z), numbers, and underscores',
              'Must be unique',
            ].map((r) => (
              <Text key={r} style={styles.ruleItem}>• {r}</Text>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            checkState !== 'available' || submitting ? styles.buttonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={checkState !== 'available' || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Confirm Username</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  kav: { flex: 1, justifyContent: 'space-between', padding: 24 },
  content: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 8, marginTop: 20 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 32 },
  section: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  atSign: { fontSize: 18, color: COLORS.primary, fontWeight: '700', marginRight: 4 },
  usernameInput: { flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 14 },
  statusIcon: { fontSize: 18 },
  statusText: { fontSize: 13, marginTop: 8, marginLeft: 4 },
  rules: { backgroundColor: COLORS.surfaceElevated, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  rulesTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  ruleItem: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4, lineHeight: 20 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
