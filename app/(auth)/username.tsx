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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { checkUsernameAvailable } from '../../src/services/firestore';
import { completeOnboarding } from '../../src/services/auth';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/utils/constants';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
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

  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (!username) { setCheckState('idle'); return; }
    if (!USERNAME_REGEX.test(username)) { setCheckState('invalid'); return; }

    setCheckState('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setCheckState(available ? 'available' : 'taken');
      if (available) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (checkState !== 'available' || !user || submitting) return;
    if (!displayName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Name required', 'Enter your display name.');
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding(user.uid, username, displayName.trim());
      const docSnap = await getDoc(doc(getFirestore(), 'users', user.uid));
      setUserProfile(docSnap.data() as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/chats');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message ?? 'Failed to claim username. Try another.');
    } finally {
      setSubmitting(false);
    }
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

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
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.content}>
          <Text style={styles.title}>Pick your username</Text>
          <Text style={styles.subtitle}>
            This is your unique identifier on Purl. You can change it later.
          </Text>

          {/* Grouped Inset Forms */}
          <View style={styles.inputGroup}>
            <View style={[styles.section, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border }]}>
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
            </View>
          </View>
          {statusText ? (
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          ) : null}

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
        </Animated.View>

        <AnimatedPressable
          style={[
            styles.button,
            checkState !== 'available' || submitting ? styles.buttonDisabled : null,
            animatedButtonStyle
          ]}
          onPress={handleSubmit}
          onPressIn={() => { buttonScale.value = withSpring(0.96); }}
          onPressOut={() => { buttonScale.value = withSpring(1); }}
          disabled={checkState !== 'available' || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Confirm Username</Text>
          )}
        </AnimatedPressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  kav: { flex: 1, justifyContent: 'space-between', padding: 24 },
  content: { flex: 1, marginTop: 12 },
  title: { fontSize: 34, fontFamily: 'Inter_700Bold', color: COLORS.text, marginBottom: 8, letterSpacing: -1 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', color: COLORS.textSecondary, lineHeight: 22, marginBottom: 32 },
  inputGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, // iOS grouped inset style
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', color: COLORS.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    color: COLORS.text,
    paddingVertical: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  atSign: { fontSize: 17, color: COLORS.primary, fontFamily: 'Inter_700Bold', marginRight: 4 },
  usernameInput: { flex: 1, fontSize: 17, fontFamily: 'Inter_400Regular', color: COLORS.text, paddingVertical: 8 },
  statusIcon: { fontSize: 18 },
  statusText: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 8, marginLeft: 16 },
  rules: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 24 },
  rulesTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: COLORS.textSecondary, marginBottom: 8 },
  ruleItem: { fontSize: 13, fontFamily: 'Inter_400Regular', color: COLORS.textSecondary, marginBottom: 4, lineHeight: 20 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
});
