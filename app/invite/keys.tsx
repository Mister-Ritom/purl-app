import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useInviteKeys } from '../../src/hooks/useInviteKeys';
import { useAuthStore } from '../../src/store/authStore';
import { EmptyState } from '../../src/components/common/EmptyState';
import { COLORS } from '../../src/utils/constants';
import { InviteKey } from '../../src/types/inviteKey';
import { formatExpiryCountdown } from '../../src/utils/formatTime';
import { buildInviteLink } from '../../src/services/deeplink';
import firestore from '@react-native-firebase/firestore';

export default function InviteKeysScreen() {
  const { keys, loading } = useInviteKeys();
  const { user } = useAuthStore();
  const [selectedKey, setSelectedKey] = useState<InviteKey | null>(null);

  const handleRevoke = async (key: InviteKey) => {
    Alert.alert('Revoke Key', 'This will permanently disable this invite link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          await firestore().collection('users').doc(user!.uid).collection('inviteKeys').doc(key.id).update({ isActive: false });
          setSelectedKey(null);
        }
      },
    ]);
  };

  const handleShare = async (key: InviteKey) => {
    const link = buildInviteLink(key.token);
    await Share.share({ message: `Connect with me on Purl: ${link}`, url: link });
  };

  const renderKey = ({ item }: { item: InviteKey }) => {
    const isExpired = item.expiresAt ? item.expiresAt.toDate() < new Date() : false;
    const isExhausted = item.type !== 'permanent' && item.usesConsumed >= (item.usesAllowed ?? Infinity);
    const isInactive = !item.isActive || isExpired || isExhausted;

    return (
      <TouchableOpacity
        style={[styles.keyCard, isInactive && styles.keyCardInactive]}
        onPress={() => setSelectedKey(item)}
        activeOpacity={0.8}
      >
        <View style={styles.keyHeader}>
          <Text style={styles.token}>{item.token}</Text>
          <View style={[styles.statusDot, { backgroundColor: isInactive ? COLORS.textMuted : COLORS.online }]} />
        </View>
        {item.label ? <Text style={styles.keyLabel}>{item.label}</Text> : null}
        <View style={styles.keyMeta}>
          <View style={[styles.badge, { backgroundColor: COLORS.primary + '30' }]}>
            <Text style={styles.badgeText}>{item.type === 'single' ? 'Single' : item.type === 'multi' ? 'Multi' : '∞'}</Text>
          </View>
          {item.type !== 'permanent' && (
            <Text style={styles.keyMetaText}>Used {item.usesConsumed}{item.usesAllowed ? `/${item.usesAllowed}` : ''}</Text>
          )}
          <Text style={styles.keyMetaText}>{formatExpiryCountdown(item.expiresAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Invite Keys</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/invite/scan')}>
          <Text>📷</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Share these keys to let people connect with you.</Text>

      {keys.length === 0 && !loading ? (
        <EmptyState
          icon="🔑"
          title="No invite keys"
          subtitle="Create a key to start inviting people to connect with you on Purl."
          actionLabel="Create Key"
          onAction={() => router.push('/invite/create')}
        />
      ) : (
        <FlatList
          data={keys}
          keyExtractor={(k) => k.id}
          renderItem={renderKey}
          contentContainerStyle={styles.list}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/invite/create')}>
        <Text style={styles.fabText}>+ New Key</Text>
      </TouchableOpacity>

      {/* Key Modal */}
      <Modal visible={!!selectedKey} transparent animationType="slide" onRequestClose={() => setSelectedKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedKey && (
              <>
                <Text style={styles.modalToken}>{selectedKey.token}</Text>
                <QRCode value={buildInviteLink(selectedKey.token)} size={200} color={COLORS.text} backgroundColor={COLORS.surface} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => { Clipboard.setStringAsync(selectedKey.token); Alert.alert('Copied!'); }}>
                    <Text style={styles.actionBtnText}>📋 Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(selectedKey)}>
                    <Text style={styles.actionBtnText}>📤 Share</Text>
                  </TouchableOpacity>
                </View>
                {selectedKey.isActive && (
                  <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(selectedKey)}>
                    <Text style={styles.revokeBtnText}>Revoke Key</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedKey(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  header: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  scanBtn: { padding: 8 },
  subtitle: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 14, color: COLORS.textSecondary },
  list: { padding: 16, gap: 12 },
  keyCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  keyCardInactive: { opacity: 0.5 },
  keyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  token: { fontSize: 18, fontWeight: '700', color: COLORS.text, fontFamily: 'Courier New', letterSpacing: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  keyLabel: { fontSize: 13, color: COLORS.textSecondary },
  keyMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  keyMetaText: { fontSize: 12, color: COLORS.textSecondary },
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, alignItems: 'center', gap: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  modalToken: { fontSize: 22, fontWeight: '700', color: COLORS.text, fontFamily: 'Courier New', letterSpacing: 3 },
  modalActions: { flexDirection: 'row', gap: 16 },
  actionBtn: {
    backgroundColor: COLORS.surfaceElevated, borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 24, borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  revokeBtn: { borderWidth: 1, borderColor: COLORS.error, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  revokeBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 15 },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 32 },
  closeBtnText: { color: COLORS.textSecondary, fontSize: 15 },
});
