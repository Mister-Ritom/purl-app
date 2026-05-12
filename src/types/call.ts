import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Call {
  id: string;
  callerId: string;
  receiverIds: string[];
  type: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  channelName: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  startedAt?: FirebaseFirestoreTypes.Timestamp;
  endedAt?: FirebaseFirestoreTypes.Timestamp;
  duration?: number;
  callerUsername?: string;
  callerPhotoURL?: string;
  agoraToken?: string;
}
