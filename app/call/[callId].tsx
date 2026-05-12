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
import firestore from '@react-native-firebase/firestore';
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
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { user } = useAuthStore();
  const {
    activeCall, callStatus, isAudioMuted, isVideoMuted, isSpeakerOn, remoteUid,
    setCallStatus, setActiveCall, setRemoteUid,
    toggleAudio, toggleVideo, toggleSpeaker: toggleSpeakerState, reset,
  } = useCallStore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    loadCallAndJoin();
    return () => { leaveCall(); reset(); };
  }, [callId]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  async function loadCallAndJoin() {
    if (!callId || !user) return;
    try {
      const doc = await firestore().collection('calls').doc(callId).get();
      if (!doc.exists()) { router.back(); return; }
      const call = { id: doc.id, ...doc.data() } as any;
      setActiveCall(call);

      const otherUid = call.callerId === user.uid ? call.receiverIds[0] : call.callerId;
      const userDoc = await firestore().collection('users').doc(otherUid).get();
      if (userDoc.exists()) setOtherUser({ uid: otherUid, ...userDoc.data() } as UserProfile);

      setCallStatus('connecting');
      initAgoraEngine();

      const agoraUid = hashUidToNumber(user.uid);
      await joinCall(callId, call.agoraToken, agoraUid, isVideo);
    } catch (err: any) {
      Alert.alert('Call Error', err.message ?? 'Could not connect.');
      router.back();
    }
  }

  const handleEndCall = async () => {
    leaveCall();
    await firestore().collection('calls').doc(callId).update({
      status: 'ended',
      endedAt: firestore.FieldValue.serverTimestamp(),
      duration: callDuration,
    }).catch(() => {});
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

  const isVideo = activeCall?.type === 'video';
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
