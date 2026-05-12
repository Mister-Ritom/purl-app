import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { useAuthStore } from '../../src/store/authStore';
import { generateInviteToken } from '../../src/utils/generateKey';
import { COLORS } from '../../src/utils/constants';

type KeyType = 'single' | 'multi' | 'permanent';
type Expiry = '1h' | '24h' | '7d' | '30d' | 'never';

const EXPIRY_LABELS: Record<Expiry, string> = {
  '1h': '1 Hour', '24h': '24 Hours', '7d': '7 Days', '30d': '30 Days', 'never': 'Never',
};

function expiresAtDate(expiry: Expiry): Date | null {
  const now = new Date();
  if (expiry === 'never') return null;
  if (expiry === '1h') return new Date(now.getTime() + 3600000);
  if (expiry === '24h') return new Date(now.getTime() + 86400000);
  if (expiry === '7d') return new Date(now.getTime() + 7 * 86400000);
  if (expiry === '30d') return new Date(now.getTime() + 30 * 86400000);
  return null;
}

export default function CreateKeyScreen() {
  const { user } = useAuthStore();
  const [type, setType] = useState<KeyType>('single');
  const [maxUses, setMaxUses] = useState('5');
  const [expiry, setExpiry] = useState<Expiry>('7d');
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [creating, setCreating] = useState(false);

  React.useEffect(() => {
    generateInviteToken().then(setToken);
  }, []);

  const handleCreate = async () => {
    if (!user || creating || !token) return;
    setCreating(true);
    try {
      const expiresAt = expiresAtDate(expiry);
      const usesAllowed = type === 'single' ? 1 : type === 'multi' ? parseInt(maxUses, 10) : null;
      const keyId = firestore().collection('users').doc(user.uid).collection('inviteKeys').doc().id;

      await firestore().collection('users').doc(user.uid).collection('inviteKeys').doc(keyId).set({
        id: keyId,
        token,
        label,
        type,
        usesAllowed,
        usesConsumed: 0,
        expiresAt: expiresAt ? firestore.Timestamp.fromDate(expiresAt) : null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        isActive: true,
        usedBy: [],
      });

      await functions().httpsCallable('registerInviteKey')({ token, keyId });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Create Invite Key</Text>

          {/* Type selector */}
          <Text style={styles.sectionLabel}>Key Type</Text>
          <View style={styles.segmented}>
            {(['single', 'multi', 'permanent'] as KeyType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, type === t && styles.segmentBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>
                  {t === 'single' ? 'Single' : t === 'multi' ? 'Multi' : '∞ Permanent'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {type === 'multi' && (
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>Max Uses</Text>
              <TextInput
                style={styles.input}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
                maxLength={3}
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          )}

          {/* Expiry */}
          <Text style={styles.sectionLabel}>Expiry</Text>
          <View style={styles.expiryGrid}>
            {(Object.keys(EXPIRY_LABELS) as Expiry[]).map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.expiryBtn, expiry === e && styles.expiryBtnActive]}
                onPress={() => setExpiry(e)}
              >
                <Text style={[styles.expiryText, expiry === e && styles.expiryTextActive]}>{EXPIRY_LABELS[e]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Label */}
          <View style={styles.field}>
            <Text style={styles.sectionLabel}>Label (optional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. For Alex"
              placeholderTextColor={COLORS.textMuted}
              maxLength={40}
            />
          </View>

          {/* Token preview */}
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Token</Text>
            <Text style={styles.tokenValue}>{token || '...'}</Text>
            <TouchableOpacity onPress={() => generateInviteToken().then(setToken)} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>🔄 Regenerate</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, creating && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Key</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 20 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  segmented: { flexDirection: 'row', backgroundColor: COLORS.surfaceElevated, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentBtnActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  field: { gap: 8 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  expiryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  expiryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  expiryBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  expiryText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  expiryTextActive: { color: '#fff' },
  tokenCard: { backgroundColor: COLORS.surfaceElevated, borderRadius: 14, padding: 16, gap: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  tokenLabel: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  tokenValue: { fontSize: 24, fontWeight: '700', color: COLORS.text, fontFamily: 'Courier New', letterSpacing: 3 },
  refreshBtn: { paddingVertical: 8 },
  refreshText: { color: COLORS.primary, fontSize: 14 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
