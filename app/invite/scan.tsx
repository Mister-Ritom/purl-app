import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import functions from '@react-native-firebase/functions';
import { COLORS } from '../../src/utils/constants';
import { validateInviteToken, formatToken } from '../../src/utils/generateKey';

export default function ScanScreen() {
  const { token: prefilledToken } = useLocalSearchParams<{ token?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualToken, setManualToken] = useState(prefilledToken ?? '');
  const [redeeming, setRedeeming] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (prefilledToken) redeemToken(prefilledToken);
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const url = new URL(data);
      const token = url.searchParams.get('token') ?? data;
      const clean = formatToken(token);
      setManualToken(clean);
      redeemToken(clean);
    } catch {
      const clean = formatToken(data);
      setManualToken(clean);
      redeemToken(clean);
    }
  };

  const redeemToken = async (token: string) => {
    const clean = formatToken(token);
    if (!validateInviteToken(clean)) {
      Alert.alert('Invalid token', 'Please check the token format: XXXX-XXXX-XXXX');
      setScanned(false);
      return;
    }
    setRedeeming(true);
    setStatus('Connecting...');
    try {
      const result = await functions().httpsCallable('redeemInviteKey')({ token: clean });
      const { conversationId } = result.data as { conversationId: string; ownerUid: string };
      setStatus('✅ Connected! Opening chat...');
      setTimeout(() => router.replace(`/(app)/chats/${conversationId}`), 800);
    } catch (err: any) {
      setStatus('');
      setScanned(false);
      Alert.alert('Redeem failed', err.message ?? 'Invalid or expired invite key.');
    } finally {
      setRedeeming(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Scan QR Code</Text>
      <Text style={styles.subtitle}>Scan an invite QR code or enter the key manually.</Text>

      {!permission.granted ? (
        <View style={styles.noPerm}>
          <Text style={styles.noPermText}>Camera permission required to scan QR codes.</Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.scanner}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
          <View style={styles.scanFrame} />
        </View>
      )}

      {status ? (
        <View style={styles.statusBox}>
          {redeeming && <ActivityIndicator color={COLORS.primary} />}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}

      <View style={styles.manualSection}>
        <Text style={styles.manualLabel}>Or enter key manually:</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manualToken}
            onChangeText={(t) => setManualToken(t.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            maxLength={14}
          />
          <TouchableOpacity
            style={[styles.redeemBtn, (!manualToken || redeeming) && styles.btnDisabled]}
            onPress={() => redeemToken(manualToken)}
            disabled={!manualToken || redeeming}
          >
            {redeeming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.redeemBtnText}>Go</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {scanned && !redeeming && (
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setScanned(false); setStatus(''); }}>
          <Text style={styles.retryText}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  scannerContainer: { height: 280, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  scanner: { flex: 1 },
  scanFrame: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: 16,
  },
  noPerm: { height: 280, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated, borderRadius: 20, padding: 20 },
  noPermText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, marginBottom: 20 },
  grantBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  grantBtnText: { color: '#fff', fontWeight: '600' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: 12, padding: 16, marginTop: 16 },
  statusText: { color: COLORS.text, fontSize: 15, flex: 1 },
  manualSection: { marginTop: 24 },
  manualLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10, fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1, backgroundColor: COLORS.surfaceElevated, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: COLORS.text,
    fontFamily: 'Courier New', letterSpacing: 2, borderWidth: 1, borderColor: COLORS.border,
  },
  redeemBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retryBtn: { alignItems: 'center', marginTop: 20, padding: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: 12 },
  retryText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
});
