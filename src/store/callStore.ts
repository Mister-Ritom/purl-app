import { create } from 'zustand';
import { Call } from '../types/call';

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'active' | 'ended';

interface CallStore {
  activeCall: Call | null;
  incomingCall: Call | null;
  callStatus: CallStatus;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isSpeakerOn: boolean;
  remoteUid: number | null;
  setActiveCall: (call: Call | null) => void;
  setIncomingCall: (call: Call | null) => void;
  setCallStatus: (status: CallStatus) => void;
  setRemoteUid: (uid: number | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  reset: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  activeCall: null,
  incomingCall: null,
  callStatus: 'idle',
  isAudioMuted: false,
  isVideoMuted: false,
  isSpeakerOn: false,
  remoteUid: null,
  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setCallStatus: (status) => set({ callStatus: status }),
  setRemoteUid: (uid) => set({ remoteUid: uid }),
  toggleAudio: () => set((s) => ({ isAudioMuted: !s.isAudioMuted })),
  toggleVideo: () => set((s) => ({ isVideoMuted: !s.isVideoMuted })),
  toggleSpeaker: () => set((s) => ({ isSpeakerOn: !s.isSpeakerOn })),
  reset: () =>
    set({
      activeCall: null,
      callStatus: 'idle',
      isAudioMuted: false,
      isVideoMuted: false,
      isSpeakerOn: false,
      remoteUid: null,
    }),
}));
