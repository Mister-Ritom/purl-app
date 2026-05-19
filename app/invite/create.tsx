import React, { useState } from 'react';
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, setDoc, Timestamp, serverTimestamp } from '@react-native-firebase/firestore';
import { useAuthStore } from '../../src/store/authStore';
import { generateInviteToken } from '../../src/utils/generateKey';

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
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [type, setType] = useState<KeyType>('single');
  const [maxUses, setMaxUses] = useState('5');
  const [expiry, setExpiry] = useState<Expiry>('7d');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const token = await generateInviteToken();
      const expiresAt = expiresAtDate(expiry);
      const uses = type === 'single' ? 1 : type === 'multi' ? parseInt(maxUses, 10) : null;

      const keyData = {
        token,
        type,
        createdBy: user.uid,
        creatorName: user.displayName || 'Anonymous',
        usesAllowed: uses,
        usesConsumed: 0,
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        label: label.trim() || null,
        isActive: true,
        createdAt: serverTimestamp(),
      };
      
      const db = getFirestore();
      await setDoc(doc(db, 'inviteKeys', token), keyData);
      router.back();
    } catch (err: any) {
      console.error('[CreateKey] Error:', err);
      Alert.alert('Error', err.message ?? 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Key</Text>
        <View style={{ width: 28 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>

          <Text style={styles.sectionLabel} type="textSecondary">Key Type</Text>
          <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['single', 'multi', 'permanent'] as KeyType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, type === t && { backgroundColor: colors.primary }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.segmentText, type === t && { color: '#fff' }]}>
                  {t === 'single' ? 'Single' : t === 'multi' ? 'Multi' : '∞ Permanent'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {type === 'multi' && (
            <View style={styles.field}>
              <Text style={styles.sectionLabel} type="textSecondary">Max Uses</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
                maxLength={3}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}

          <Text style={styles.sectionLabel} type="textSecondary">Expiry</Text>
          <View style={styles.expiryGrid}>
            {(Object.keys(EXPIRY_LABELS) as Expiry[]).map((e) => (
              <TouchableOpacity
                key={e}
                style={[
                  styles.expiryBtn, 
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  expiry === e && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setExpiry(e)}
              >
                <Text style={[styles.expiryText, expiry === e && { color: '#fff' }]}>{EXPIRY_LABELS[e]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.sectionLabel} type="textSecondary">Label (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. For Alex"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
            />
          </View>

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }, creating && styles.btnDisabled]}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 20, gap: 20, paddingTop: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentText: { fontSize: 13, fontWeight: '600' },
  field: { gap: 8 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  expiryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  expiryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  expiryText: { fontSize: 13, fontWeight: '600' },
  createBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
