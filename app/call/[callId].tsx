import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useLocalSearchParams, router } from "expo-router";
import {
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
} from "react-native-agora";
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";
import { Platform } from "react-native";
import { useCallStore } from "../../src/store/callStore";
import { useAuthStore } from "../../src/store/authStore";
import { Avatar } from "../../src/components/common/Avatar";
import OverlayToast from "../../src/components/common/OverlayToast";
import { COLORS } from "../../src/utils/constants";
import {
  initAgoraEngine,
  joinCall,
  leaveCall,
  muteAudio,
  muteVideo,
  setSpeakerphone,
} from "../../src/services/agora";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "@react-native-firebase/firestore";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { UserProfile } from "../../src/types/user";
import { formatDuration } from "../../src/utils/formatTime";

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
  const { callId, receiverId, receiverName, receiverPhoto, type } =
    useLocalSearchParams<{
      callId: string;
      receiverId?: string;
      receiverName?: string;
      receiverPhoto?: string;
      type?: string;
    }>();
  const { user } = useAuthStore();
  const {
    activeCall,
    callStatus,
    isAudioMuted,
    isVideoMuted,
    isSpeakerOn,
    remoteUid,
    setCallStatus,
    setActiveCall,
    setRemoteUid,
    toggleAudio,
    toggleVideo,
    toggleSpeaker: toggleSpeakerState,
    reset,
  } = useCallStore();

  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showEndToast, setShowEndToast] = useState(false);
  const [resolvedCallId, setResolvedCallId] = useState<string | null>(
    callId === "outgoing" ? null : callId,
  );

  const hasNavigatedBack = useRef(false);

  useEffect(() => {
    if (callId === "outgoing" && receiverId) {
      setOtherUser({
        uid: receiverId,
        displayName: receiverName || "User",
        photoURL: receiverPhoto || "",
      } as any);
      setCallStatus("connecting");
    }
  }, [callId, receiverId, receiverName, receiverPhoto]);

  useEffect(() => {
    if (callId !== "outgoing" || !receiverId) return;

    let active = true;
    const initiate = async () => {
      try {
        const result = await httpsCallable(
          getFunctions(),
          "initiateCall",
        )({
          receiverIds: [receiverId],
          type: type || "voice",
        });
        const { callId: realCallId } = result.data as { callId: string };
        if (active) {
          setResolvedCallId(realCallId);
        } else {
          // Clean up the created call document if caller cancelled early
          await updateDoc(doc(getFirestore(), "calls", realCallId), {
            status: "ended",
            endedAt: serverTimestamp(),
            duration: 0,
          }).catch(() => {});
        }
      } catch (err: any) {
        console.error("[CallScreen] initiateCall error:", err);
        Alert.alert("Call Failed", err.message ?? "Could not initiate call.");
        if (!hasNavigatedBack.current) {
          hasNavigatedBack.current = true;
          router.back();
        }
      }
    };

    initiate();

    return () => {
      active = false;
    };
  }, [callId, receiverId, type]);

  useEffect(() => {
    if (!resolvedCallId) return;

    loadCallAndJoin(resolvedCallId);

    // Listen for call status changes (e.g., other user declined or ended)
    const unsub = onSnapshot(
      doc(getFirestore(), "calls", resolvedCallId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setActiveCall({ id: snapshot.id, ...data } as any);
          if (data?.status === "ended" || data?.status === "declined") {
            setCallStatus("ended");
          } else if (data?.status === "accepted") {
            setCallStatus("connected");
          } else if (data?.status === "active") {
            setCallStatus("active");
          }
        } else {
          setCallStatus("ended");
        }
      },
    );

    return () => {
      unsub();
      leaveCall();
      reset();
    };
  }, [resolvedCallId]);

  useEffect(() => {
    if (callStatus === "ended") {
      setShowEndToast(true);
      const timer = setTimeout(() => {
        if (!hasNavigatedBack.current) {
          hasNavigatedBack.current = true;
          router.back();
        }
      }, 1700);
      return () => clearTimeout(timer);
    }
    // Only start timer if both local and remote are active
    if (callStatus !== "active" || activeCall?.status !== "active") return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus, activeCall?.status]);

  async function loadCallAndJoin(targetCallId: string) {
    if (!user) return;
    try {
      const callDocRef = doc(getFirestore(), "calls", targetCallId);
      const callDocSnap = await getDoc(callDocRef);
      if (!callDocSnap.exists()) {
        if (!hasNavigatedBack.current) {
          hasNavigatedBack.current = true;
          router.back();
        }
        return;
      }
      const call = { id: callDocSnap.id, ...callDocSnap.data() } as any;
      setActiveCall(call);

      const otherUid =
        call.callerId === user.uid ? call.receiverIds[0] : call.callerId;
      const userDocSnap = await getDoc(doc(getFirestore(), "users", otherUid));
      if (userDocSnap.exists())
        setOtherUser({ uid: otherUid, ...userDocSnap.data() } as UserProfile);

      // Request Permissions
      if (Platform.OS === "ios") {
        await request(PERMISSIONS.IOS.MICROPHONE);
        if (call.type === "video") await request(PERMISSIONS.IOS.CAMERA);
      } else {
        await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (call.type === "video") await request(PERMISSIONS.ANDROID.CAMERA);
      }

      setCallStatus("connecting");
      initAgoraEngine();

      const agoraUid = hashUidToNumber(user.uid);
      const isVideoCall = call.type === "video";

      let token = call.agoraToken;
      // If we are the receiver, we should get our own token to be safe,
      // as tokens are UID-bound.
      if (call.callerId !== user.uid) {
        try {
          const result = await httpsCallable(
            getFunctions(),
            "generateAgoraToken",
          )({
            channelName: targetCallId,
            uid: user.uid,
          });
          token = (result.data as any).token;
        } catch (err: any) {
          console.error("[CallScreen] generateAgoraToken error:", err);
          if (err.code === "unauthenticated") {
            throw new Error("Your session expired. Please log in again.");
          }
          throw err;
        }
      }

      if (!token) throw new Error("No Agora token available");

      await joinCall(targetCallId, token, agoraUid, isVideoCall);

      if (call.callerId === user.uid) {
        setCallStatus("ringing");
      } else {
        // If receiver, mark call as active in Firestore
        if (call.status === "ringing" || call.status === "accepted") {
          await updateDoc(callDocRef, {
            status: "active",
            startedAt: serverTimestamp(),
          });
        }
        setCallStatus("active");
      }
    } catch (err: any) {
      console.error("[CallScreen] Load/Join error:", err);
      Alert.alert("Call Error", err.message ?? "Could not connect.");
      if (!hasNavigatedBack.current) {
        hasNavigatedBack.current = true;
        router.back();
      }
    }
  }

  const handleEndCall = async () => {
    leaveCall();
    if (resolvedCallId) {
      await updateDoc(doc(getFirestore(), "calls", resolvedCallId), {
        status: "ended",
        endedAt: serverTimestamp(),
        duration: callDuration,
      }).catch(() => {});
    }
    reset();
    if (!hasNavigatedBack.current) {
      hasNavigatedBack.current = true;
      router.back();
    }
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

  const isVideo = activeCall?.type === "video" || type === "video";
  const displayName =
    otherUser?.displayName ?? otherUser?.username ?? "Unknown";

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
        {!isVideo && (
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Top Info */}
        <Animated.View
          entering={FadeInDown.duration(800).damping(20)}
          style={styles.topBar}
        >
          {!isVideo && (
            <Avatar
              uri={otherUser?.photoURL}
              name={displayName}
              size="xl"
              style={styles.avatar}
            />
          )}
          <Text style={styles.callerName}>{displayName}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === "connecting"
              ? "Connecting..."
              : callStatus === "ringing"
                ? "Ringing..."
                : callStatus === "connected"
                  ? "Connected"
                  : callStatus === "active"
                    ? formatDuration(callDuration)
                    : "Call Ended"}
          </Text>
        </Animated.View>

        {/* Local video preview */}
        {isVideo && callStatus === "active" && (
          <View style={styles.localVideoContainer}>
            <RtcSurfaceView style={styles.localVideo} canvas={{ uid: 0 }} />
          </View>
        )}

        {/* Controls */}
        <Animated.View
          entering={FadeIn.duration(600).delay(300)}
          style={styles.controls}
        >
          <Pressable
            style={[styles.ctrlBtn, isAudioMuted && styles.ctrlBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleMuteAudio();
            }}
          >
            <Text style={styles.ctrlIcon}>{isAudioMuted ? "🔇" : "🎙️"}</Text>
          </Pressable>

          {isVideo && (
            <Pressable
              style={[styles.ctrlBtn, isVideoMuted && styles.ctrlBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleMuteVideo();
              }}
            >
              <Text style={styles.ctrlIcon}>{isVideoMuted ? "📷" : "📹"}</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleToggleSpeaker();
            }}
          >
            <Text style={styles.ctrlIcon}>{isSpeakerOn ? "🔊" : "🔈"}</Text>
          </Pressable>

          <Pressable
            style={styles.endBtn}
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              handleEndCall();
            }}
          >
            <Text style={styles.endIcon}>📵</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
      {showEndToast && <OverlayToast message="Call ended" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  avatar: {
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  callerName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  callStatusText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
  },
  localVideoContainer: {
    position: "absolute",
    top: 80,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  localVideo: { flex: 1 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,20,25,0.6)",
    borderRadius: 40,
    padding: 16,
    gap: 20,
    marginBottom: 40,
    marginHorizontal: 24,
  },
  ctrlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnActive: { backgroundColor: "#fff" },
  ctrlIcon: { fontSize: 26 },
  endBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  endIcon: { fontSize: 30 },
});
