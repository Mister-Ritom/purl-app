import React, { useState, useEffect } from 'react';
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { View, Text, useThemeColor } from '../../src/components/Themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { 
  getFirestore, 
  doc, 
  runTransaction, 
  serverTimestamp,
  Timestamp, 
} from '@react-native-firebase/firestore';
import { useAuthStore } from '../../src/store/authStore';
import { validateInviteToken, formatToken } from '../../src/utils/generateKey';

export default function ScanScreen() {
  const { user: currentUser } = useAuthStore();
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

    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to redeem an invite.');
      return;
    }

    setRedeeming(true);
    setStatus('Validating key...');
    const db = getFirestore();

    try {
      const finalId = await runTransaction(db, async (transaction) => {
        const keyRef = doc(db, 'inviteKeys', clean);
        const keySnap = await transaction.get(keyRef);

        if (!keySnap.exists()) throw new Error('Invite key not found.');
        const keyData = keySnap.data()!;

        if (!keyData.isActive) throw new Error('This invite key is no longer active.');
        
        if (keyData.expiresAt && (keyData.expiresAt as Timestamp).toDate() < new Date()) {
          throw new Error('This invite key has expired.');
        }

        if (keyData.usesAllowed !== null && keyData.usesConsumed >= keyData.usesAllowed) {
          throw new Error('This invite key has reached its maximum usage.');
        }

        if (keyData.createdBy === currentUser.uid) {
          throw new Error('You cannot redeem your own invite key.');
        }

        // Deterministic conversation ID for direct chat
        const participants = [keyData.createdBy, currentUser.uid].sort();
        const convId = `direct_${participants[0]}_${participants[1]}`;
        const convRef = doc(db, 'conversations', convId);
        const convSnap = await transaction.get(convRef);

        if (!convSnap.exists()) {
          // Create the conversation
          transaction.set(convRef, {
            participants,
            isGroup: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: {
              text: 'Conversation started via invite',
              senderId: 'system',
              timestamp: serverTimestamp(),
            },
            inviteKeyUsed: clean,
            metadata: {
              [participants[0]]: { joinedAt: serverTimestamp() },
              [participants[1]]: { joinedAt: serverTimestamp() },
            }
          });
        }

        // Consume the key (Single Source of Truth — global collection only)
        const newConsumed = (keyData.usesConsumed || 0) + 1;
        const stillActive = keyData.usesAllowed !== null && newConsumed >= keyData.usesAllowed ? false : true;
        
        transaction.update(keyRef, {
          usesConsumed: newConsumed,
          isActive: stillActive,
        });


        return convId;
      });

      setStatus('✅ Success! Opening chat...');
      setTimeout(() => router.replace(`/chats/${finalId}`), 1000);

    } catch (err: any) {
      console.error('[Redeem] Error:', err);
      setStatus('');
      setScanned(false);
      Alert.alert('Redeem failed', err.message ?? 'Invalid or expired invite key.');
    } finally {
      setRedeeming(false);
    }
  };

  const primary = useThemeColor({}, 'primary');
  const surface = useThemeColor({}, 'surfaceElevated');
  const border = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textSecondary');
  const textColor = useThemeColor({}, 'text');

  if (!permission) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title} type="text">Scan QR Code</Text>
      <Text style={styles.subtitle} type="textSecondary">Scan an invite QR code or enter the key manually.</Text>

      {!permission.granted ? (
        <View style={[styles.noPerm, { backgroundColor: surface }]}>
          <Text style={styles.noPermText} type="textSecondary">Camera permission required to scan QR codes.</Text>
          <TouchableOpacity style={[styles.grantBtn, { backgroundColor: primary }]} onPress={requestPermission}>
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
          <View style={[styles.scanFrame, { borderColor: primary }]} />
        </View>
      )}

      {status ? (
        <View style={[styles.statusBox, { backgroundColor: surface }]}>
          {redeeming && <ActivityIndicator color={primary} />}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}

      <View style={styles.manualSection}>
        <Text style={styles.manualLabel} type="textSecondary">Or enter key manually:</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={[styles.manualInput, { backgroundColor: surface, borderColor: border, color: textColor }]}
            value={manualToken}
            onChangeText={(t) => setManualToken(t.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={textMuted}
            autoCapitalize="characters"
            maxLength={14}
          />
          <TouchableOpacity
            style={[styles.redeemBtn, { backgroundColor: primary }, (!manualToken || redeeming) && styles.btnDisabled]}
            onPress={() => redeemToken(manualToken)}
            disabled={!manualToken || redeeming}
          >
            {redeeming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.redeemBtnText}>Go</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {scanned && !redeeming && (
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: surface }]} onPress={() => { setScanned(false); setStatus(''); }}>
          <Text style={[styles.retryText, { color: primary }]}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  scannerContainer: { height: 280, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  scanner: { flex: 1 },
  scanFrame: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 2, borderRadius: 16,
  },
  noPerm: { height: 280, alignItems: 'center', justifyContent: 'center', borderRadius: 20, padding: 20 },
  noPermText: { textAlign: 'center', fontSize: 14, marginBottom: 20 },
  grantBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  grantBtnText: { color: '#fff', fontWeight: '600' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 16, marginTop: 16 },
  statusText: { fontSize: 15, flex: 1 },
  manualSection: { marginTop: 24 },
  manualLabel: { fontSize: 13, marginBottom: 10, fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 18,
    fontFamily: 'Courier New', letterSpacing: 2, borderWidth: 1,
  },
  redeemBtn: { borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retryBtn: { alignItems: 'center', marginTop: 20, padding: 12, borderRadius: 12 },
  retryText: { fontWeight: '600', fontSize: 15 },
});
