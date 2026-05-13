import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useCallStore } from '../../store/callStore';
import { Avatar } from '../common/Avatar';
import { COLORS } from '../../utils/constants';
import { router } from 'expo-router';
import { getFirestore, doc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';

export function IncomingCallOverlay() {
  const { incomingCall, setIncomingCall } = useCallStore();

  if (!incomingCall) return null;

  const handleAccept = () => {
    const callId = incomingCall.id;
    const type = incomingCall.type;
    setIncomingCall(null);
    router.push({ pathname: `/call/${callId}`, params: { type } } as any);
  };

  const handleDecline = async () => {
    try {
      await updateDoc(doc(getFirestore(), 'calls', incomingCall.id), {
        status: 'declined',
        endedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error declining call:', e);
    }
    setIncomingCall(null);
  };

  return (
    <Modal visible={!!incomingCall} transparent animationType="slide">
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={styles.blur}>
          <View style={styles.content}>
            <Avatar 
              uri={incomingCall.callerPhotoURL} 
              name={incomingCall.callerUsername ?? 'Someone'} 
              size="lg" 
            />
            <Text style={styles.name}>{incomingCall.callerUsername ?? 'Someone'}</Text>
            <Text style={styles.type}>Incoming {incomingCall.type} call...</Text>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={handleDecline}>
                <Text style={styles.btnIcon}>📵</Text>
                <Text style={styles.btnText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={handleAccept}>
                <Text style={styles.btnIcon}>{incomingCall.type === 'video' ? '📹' : '📞'}</Text>
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blur: {
    padding: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  type: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
    width: '100%',
    justifyContent: 'center',
  },
  btn: {
    alignItems: 'center',
    gap: 8,
  },
  declineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 20,
    borderRadius: 24,
  },
  acceptBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    padding: 20,
    borderRadius: 24,
  },
  btnIcon: {
    fontSize: 32,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
