import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useInviteKeys } from '../../src/hooks/useInviteKeys';
import { useAuthStore } from '../../src/store/authStore';
import { EmptyState } from '../../src/components/common/EmptyState';
import { InviteKey } from '../../src/types/inviteKey';
import { formatExpiryCountdown } from '../../src/utils/formatTime';
import { buildInviteLink } from '../../src/services/deeplink';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';

export default function InviteKeysScreen() {
  const { colors } = useTheme();
  const { keys, loading } = useInviteKeys();
  const { user } = useAuthStore();
  const [selectedKey, setSelectedKey] = useState<InviteKey | null>(null);

  const handleRevoke = async (key: InviteKey) => {
    Alert.alert('Revoke Key', 'This will permanently disable this invite link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await updateDoc(doc(getFirestore(), 'inviteKeys', key.id), { isActive: false });
            setSelectedKey(null);
          } catch (err) {
            Alert.alert('Error', 'Failed to revoke key');
          }
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
        style={[styles.keyCard, { backgroundColor: colors.surface, borderColor: colors.border }, isInactive && styles.keyCardInactive]}
        onPress={() => setSelectedKey(item)}
        activeOpacity={0.8}
      >
        <View style={styles.keyHeader}>
          <Text style={styles.token}>{item.token}</Text>
          <View style={[styles.statusDot, { backgroundColor: isInactive ? colors.textMuted : colors.online }]} />
        </View>
        {item.label ? <Text style={styles.keyLabel} type="textSecondary">{item.label}</Text> : null}
        <View style={styles.keyMeta}>
          <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{item.type === 'single' ? 'Single' : item.type === 'multi' ? 'Multi' : '∞'}</Text>
          </View>
          {item.type !== 'permanent' && (
            <Text style={styles.keyMetaText} type="textSecondary">Used {item.usesConsumed}{item.usesAllowed ? `/${item.usesAllowed}` : ''}</Text>
          )}
          <Text style={styles.keyMetaText} type="textSecondary">{formatExpiryCountdown(item.expiresAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.header}>Invite Keys</Text>
        </View>
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/invite/scan')}>
          <Text style={{ fontSize: 24 }}>📷</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle} type="textSecondary">Share these keys to let people connect with you.</Text>

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

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => router.push('/invite/create')}>
        <Text style={styles.fabText}>+ New Key</Text>
      </TouchableOpacity>

      {/* Key Modal */}
      <Modal visible={!!selectedKey} transparent animationType="slide" onRequestClose={() => setSelectedKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {selectedKey && (
              <>
                <Text style={styles.modalToken}>{selectedKey.token}</Text>
                <QRCode value={buildInviteLink(selectedKey.token)} size={200} color={colors.text} backgroundColor={colors.surface} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => { Clipboard.setStringAsync(selectedKey.token); Alert.alert('Copied!'); }}>
                    <Text style={styles.actionBtnText}>📋 Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => handleShare(selectedKey)}>
                    <Text style={styles.actionBtnText}>📤 Share</Text>
                  </TouchableOpacity>
                </View>
                {selectedKey.isActive && (
                  <TouchableOpacity style={[styles.revokeBtn, { borderColor: colors.error }]} onPress={() => handleRevoke(selectedKey)}>
                    <Text style={[styles.revokeBtnText, { color: colors.error }]}>Revoke Key</Text>
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
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4, marginLeft: -8 },
  header: { fontSize: 24, fontWeight: '800' },
  scanBtn: { padding: 8 },
  subtitle: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 14 },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  keyCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  keyCardInactive: { opacity: 0.5 },
  keyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  token: { fontSize: 18, fontWeight: '700', fontFamily: 'Courier New', letterSpacing: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  keyLabel: { fontSize: 13 },
  keyMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  keyMetaText: { fontSize: 12 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },
  fabText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, alignItems: 'center', gap: 20, borderWidth: 1,
  },
  modalToken: { fontSize: 22, fontWeight: '700', fontFamily: 'Courier New', letterSpacing: 3 },
  modalActions: { flexDirection: 'row', gap: 16 },
  actionBtn: {
    borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 24, borderWidth: 1,
  },
  actionBtnText: { fontWeight: '600', fontSize: 15 },
  revokeBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  revokeBtnText: { fontWeight: '600', fontSize: 15 },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 32 },
  closeBtnText: { fontSize: 15, opacity: 0.6 },
});
