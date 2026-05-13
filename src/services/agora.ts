import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';
import { AGORA_APP_ID } from '../utils/constants';
import { useCallStore } from '../store/callStore';

let engine: IRtcEngine | null = null;
let eventHandlers: Array<() => void> = [];

export function initAgoraEngine(): IRtcEngine {
  if (engine) return engine;

  engine = createAgoraRtcEngine();
  engine.initialize({
    appId: AGORA_APP_ID,
    channelProfile: ChannelProfileType.ChannelProfileCommunication,
  });
  engine.enableAudio();

  engine.addListener('onUserJoined', (connection, remoteUid) => {
    useCallStore.getState().setRemoteUid(remoteUid);
    useCallStore.getState().setCallStatus('active');
  });

  engine.addListener('onUserOffline', (connection, remoteUid, reason) => {
    useCallStore.getState().setRemoteUid(null);
    useCallStore.getState().setCallStatus('ended');
  });

  engine.addListener('onJoinChannelSuccess', (connection, elapsed) => {
    // console.log('Successfully joined channel');
  });

  engine.addListener('onLeaveChannel', (connection, stats) => {
    useCallStore.getState().setCallStatus('ended');
  });

  engine.addListener('onError', (err, msg) => {
    console.warn('Agora error:', err, msg);
  });

  return engine;
}

export async function joinCall(
  channelName: string,
  token: string,
  agoraUid: number,
  isVideo: boolean
): Promise<void> {
  if (!engine) initAgoraEngine();
  if (isVideo) {
    engine!.enableVideo();
    engine!.startPreview();
  }
  await engine!.joinChannel(token, channelName, agoraUid, {
    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    publishMicrophoneTrack: true,
    publishCameraTrack: isVideo,
    autoSubscribeAudio: true,
    autoSubscribeVideo: isVideo,
  });
}

export function leaveCall(): void {
  if (!engine) return;
  engine.leaveChannel();
  engine.stopPreview();
  engine.disableVideo();
}

export function muteAudio(muted: boolean): void {
  engine?.muteLocalAudioStream(muted);
}

export function muteVideo(muted: boolean): void {
  engine?.muteLocalVideoStream(muted);
}

export function switchCamera(): void {
  engine?.switchCamera();
}

export function setSpeakerphone(on: boolean): void {
  engine?.setEnableSpeakerphone(on);
}

export function destroyEngine(): void {
  engine?.release();
  engine = null;
}

export { RtcSurfaceView };
