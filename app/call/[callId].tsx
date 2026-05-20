import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { RtcSurfaceView, ChannelProfileType, ClientRoleType } from 'react-native-agora';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';
import { useCallStore } from '../../src/store/callStore';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/common/Avatar';
import { COLORS } from '../../src/utils/constants';
import {
  initAgoraEngine,
  joinCall,
  leaveCall,
  muteAudio,
  muteVideo,
  setSpeakerphone,
} from '../../src/services/agora';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, onSnapshot } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { UserProfile } from '../../src/types/user';
import { formatDuration } from '../../src/utils/formatTime';

export function hashUidToNumber(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export default function CallScreen() {
  const { callId, isOutgoing, receiverId, receiverName, receiverPhoto, type } = useLocalSearchParams<{
    callId: string;
    isOutgoing?: string;
    receiverId?: string;
    receiverName?: string;
    receiverPhoto?: string;
    type?: string;
  }>();
  const { user } = useAuthStore();
  const {
    activeCall, callStatus, isAudioMuted, isVideoMuted, isSpeakerOn, remoteUid,
    setCallStatus, setActiveCall, setRemoteUid,
    toggleAudio, toggleVideo, toggleSpeaker: toggleSpeakerState, reset,
  } = useCallStore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (callId === 'outgoing' && receiverId) {
      setOtherUser({
        uid: receiverId,
        displayName: receiverName || 'User',
        photoURL: receiverPhoto || '',
      } as any);
      setCallStatus('connecting');
    }
  }, [callId, receiverId, receiverName, receiverPhoto]);

  useEffect(() => {
    if (callId !== 'outgoing' || !receiverId) return;

    let active = true;
    const initiate = async () => {
      try {
        const result = await httpsCallable(getFunctions(), 'initiateCall')({
          receiverIds: [receiverId],
          type: type || 'voice',
        });
        const { callId: realCallId } = result.data as { callId: string };
        if (active) {
          router.replace({
            pathname: `/call/${realCallId}`,
            params: { type },
          } as any);
        }
      } catch (err: any) {
        console.error('[CallScreen] initiateCall error:', err);
        Alert.alert('Call Failed', err.message ?? 'Could not initiate call.');
        router.back();
      }
    };

    initiate();

    return () => {
      active = false;
    };
  }, [callId, receiverId, type]);

  useEffect(() => {
    if (!callId || callId === 'outgoing') return;

    loadCallAndJoin();
    
    // Listen for call status changes (e.g., other user declined or ended)
    const unsub = onSnapshot(doc(getFirestore(), 'calls', callId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveCall({ id: snapshot.id, ...data } as any);
        if (data?.status === 'ended' || data?.status === 'declined') {
          setCallStatus('ended');
        } else if (data?.status === 'active') {
          setCallStatus('active');
        }
      } else {
        setCallStatus('ended');
      }
    });

    return () => { 
      unsub();
      leaveCall(); 
      reset(); 
    };
  }, [callId]);

  useEffect(() => {
    if (callStatus === 'ended') {
      const timer = setTimeout(() => router.back(), 2000);
      return () => clearTimeout(timer);
    }
    // Only start timer if both local and remote are active
    if (callStatus !== 'active' || activeCall?.status !== 'active') return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus, activeCall?.status]);

  async function loadCallAndJoin() {
    if (!callId || callId === 'outgoing' || !user) return;
    try {
      const callDocRef = doc(getFirestore(), 'calls', callId);
      const callDocSnap = await getDoc(callDocRef);
      if (!callDocSnap.exists()) { router.back(); return; }
      const call = { id: callDocSnap.id, ...callDocSnap.data() } as any;
      setActiveCall(call);

      const otherUid = call.callerId === user.uid ? call.receiverIds[0] : call.callerId;
      const userDocSnap = await getDoc(doc(getFirestore(), 'users', otherUid));
      if (userDocSnap.exists()) setOtherUser({ uid: otherUid, ...userDocSnap.data() } as UserProfile);

      // Request Permissions
      if (Platform.OS === 'ios') {
        await request(PERMISSIONS.IOS.MICROPHONE);
        if (call.type === 'video') await request(PERMISSIONS.IOS.CAMERA);
      } else {
        await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (call.type === 'video') await request(PERMISSIONS.ANDROID.CAMERA);
      }

      setCallStatus('connecting');
      initAgoraEngine();

      const agoraUid = hashUidToNumber(user.uid);
      const isVideoCall = call.type === 'video';

      let token = call.agoraToken;
      // If we are the receiver, we should get our own token to be safe, 
      // as tokens are UID-bound.
      if (call.callerId !== user.uid) {
        try {
          const result = await httpsCallable(getFunctions(), 'generateAgoraToken')({
            channelName: callId,
            uid: user.uid
          });
          token = (result.data as any).token;
        } catch (err: any) {
          console.error('[CallScreen] generateAgoraToken error:', err);
          if (err.code === 'unauthenticated') {
            throw new Error('Your session expired. Please log in again.');
          }
          throw err;
        }
      }

      if (!token) throw new Error('No Agora token available');

      await joinCall(callId, token, agoraUid, isVideoCall);
      
      if (call.callerId === user.uid) {
        setCallStatus('ringing');
      } else {
        // If receiver, mark call as active in Firestore
        if (call.status === 'ringing' || call.status === 'accepted') {
          await updateDoc(callDocRef, {
            status: 'active',
            startedAt: serverTimestamp(),
          });
        }
        setCallStatus('active');
      }
    } catch (err: any) {
      console.error('[CallScreen] Load/Join error:', err);
      Alert.alert('Call Error', err.message ?? 'Could not connect.');
      router.back();
    }
  }

  const handleEndCall = async () => {
    leaveCall();
    if (callId !== 'outgoing') {
      await updateDoc(doc(getFirestore(), 'calls', callId), {
        status: 'ended',
        endedAt: serverTimestamp(),
        duration: callDuration,
      }).catch(() => {});
    }
    reset();
    router.back();
  };

  const handleMuteAudio = () => {
    muteAudio(!isAudioMuted);
    toggleAudio();
  };

  const handleMuteVideo = () => {
    muteVideo(!isVideoMuted);
    toggleVideo();
  };

  const handleToggleSpeaker = () => {
    setSpeakerphone(!isSpeakerOn);
    toggleSpeakerState();
  };

  const isVideo = activeCall?.type === 'video' || type === 'video';
  const displayName = otherUser?.displayName ?? otherUser?.username ?? 'Unknown';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Video Views */}
      {isVideo && remoteUid !== null && (
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUid }}
        />
      )}

      <SafeAreaView style={styles.overlay}>
        {/* Top Info */}
        <View style={styles.topBar}>
          {!isVideo && (
            <Avatar uri={otherUser?.photoURL} name={displayName} size="xl" style={styles.avatar} />
          )}
          <Text style={styles.callerName}>{displayName}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === 'connecting' ? '🔄 Connecting...'
              : callStatus === 'ringing' ? '📳 Ringing...'
              : callStatus === 'active' ? formatDuration(callDuration)
              : 'Ending...'}
          </Text>
        </View>

        {/* Local video preview */}
        {isVideo && callStatus === 'active' && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView
              style={styles.localVideo}
              canvas={{ uid: 0 }}
            />
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.ctrlBtn, isAudioMuted && styles.ctrlBtnActive]} onPress={handleMuteAudio}>
            <Text style={styles.ctrlIcon}>{isAudioMuted ? '🔇' : '🎙️'}</Text>
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity style={[styles.ctrlBtn, isVideoMuted && styles.ctrlBtnActive]} onPress={handleMuteVideo}>
              <Text style={styles.ctrlIcon}>{isVideoMuted ? '📷' : '📹'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]} onPress={handleToggleSpeaker}>
            <Text style={styles.ctrlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
            <Text style={styles.endIcon}>📵</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 24 },
  topBar: { alignItems: 'center', paddingTop: 20 },
  avatar: { marginBottom: 20 },
  callerName: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  callStatusText: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  localVideoContainer: { position: 'absolute', top: 80, right: 20, width: 100, height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.primary },
  localVideo: { flex: 1 },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, padding: 12, gap: 16,
    marginBottom: 20,
  },
  ctrlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnActive: { backgroundColor: COLORS.primary },
  ctrlIcon: { fontSize: 24 },
  endBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  endIcon: { fontSize: 28 },
});
