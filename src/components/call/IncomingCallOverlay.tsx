import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCallStore } from '../../store/callStore';
import { Avatar } from '../common/Avatar';
import { COLORS } from '../../utils/constants';
import { router } from 'expo-router';
import { 
  getFirestore, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  onSnapshot,
} from '@react-native-firebase/firestore';
import { useAuthStore } from '../../store/authStore';

export function IncomingCallOverlay() {
  const { incomingCall, setIncomingCall } = useCallStore();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Animation values for concentric pulsing rings
  const pulse1 = React.useRef(new Animated.Value(0)).current;
  const pulse2 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (incomingCall) {
      pulse1.setValue(0);
      pulse2.setValue(0);

      const anim1 = Animated.loop(
        Animated.timing(pulse1, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        })
      );

      const anim2 = Animated.loop(
        Animated.sequence([
          Animated.delay(1100),
          Animated.timing(pulse2, {
            toValue: 1,
            duration: 2200,
            useNativeDriver: true,
          }),
        ])
      );

      anim1.start();
      anim2.start();

      return () => {
        anim1.stop();
        anim2.stop();
      };
    }
  }, [incomingCall]);

  React.useEffect(() => {
    if (!user) return;

    const q = query(
      collection(getFirestore(), 'calls'),
      where('receiverIds', 'array-contains', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Find the most recent fresh call
        const now = Date.now();
        const freshCall = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(c => {
            const createdAt = c.createdAt?.toMillis?.() || 0;
            return (now - createdAt < 60000);
          })
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];

        if (freshCall && !incomingCall) {
          setIncomingCall(freshCall);
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  if (!incomingCall) return null;

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const callId = incomingCall.id;
    const type = incomingCall.type;
    
    // Update status so the listener stops triggering for this call
    try {
      await updateDoc(doc(getFirestore(), 'calls', callId), {
        status: 'accepted',
      });
    } catch (e) {
      console.error('Error accepting call:', e);
    }

    setIncomingCall(null);
    router.push({ pathname: `/call/${callId}`, params: { type } } as any);
  };

  const handleDecline = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  const ring1Style = {
    transform: [{
      scale: pulse1.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.2],
      })
    }],
    opacity: pulse1.interpolate({
      inputRange: [0, 0.1, 0.8, 1],
      outputRange: [0, 0.45, 0.45, 0],
    }),
  };

  const ring2Style = {
    transform: [{
      scale: pulse2.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.2],
      })
    }],
    opacity: pulse2.interpolate({
      inputRange: [0, 0.1, 0.8, 1],
      outputRange: [0, 0.45, 0.45, 0],
    }),
  };

  return (
    <Modal visible={!!incomingCall} transparent animationType="slide">
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <BlurView intensity={100} tint="dark" style={styles.blur}>
          <View style={styles.content}>
            
            {/* Concentric rings animation behind avatar */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.pulseRing, ring1Style]} />
              <Animated.View style={[styles.pulseRing, ring2Style]} />
              <Avatar 
                uri={incomingCall.callerPhotoURL} 
                name={incomingCall.callerUsername ?? 'Someone'} 
                size="lg" 
              />
            </View>

            <Text style={styles.name}>{incomingCall.callerUsername ?? 'Someone'}</Text>
            <Text style={styles.type}>Incoming {incomingCall.type} call...</Text>

            <View style={styles.actions}>
              <View style={styles.btnWrapper}>
                <TouchableOpacity 
                  style={[styles.circularBtn, styles.declineCircularBtn]} 
                  onPress={handleDecline}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnIcon}>📵</Text>
                </TouchableOpacity>
                <Text style={styles.btnTextLabel}>Decline</Text>
              </View>

              <View style={styles.btnWrapper}>
                <TouchableOpacity 
                  style={[styles.circularBtn, styles.acceptCircularBtn]} 
                  onPress={handleAccept}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnIcon}>
                    {incomingCall.type === 'video' ? '📹' : '📞'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.btnTextLabel}>Accept</Text>
              </View>
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
    marginHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(45, 212, 191, 0.55)', // Elegant teal ring
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  type: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 4,
    marginBottom: 28,
    fontFamily: 'Inter_500Medium',
  },
  actions: {
    flexDirection: 'row',
    gap: 48,
    width: '100%',
    justifyContent: 'center',
  },
  btnWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  circularBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  declineCircularBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  acceptCircularBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  btnIcon: {
    fontSize: 24,
    color: '#fff',
  },
  btnTextLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
