import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  about: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: FirebaseFirestoreTypes.Timestamp;
  fcmToken: string;
  twoStepHash?: string;
  settings: UserSettings;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface UserSettings {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  photoVisibility: 'everyone' | 'contacts' | 'nobody';
  aboutVisibility: 'everyone' | 'contacts' | 'nobody';
  statusVisibility: 'everyone' | 'contacts' | 'nobody' | 'custom';
  readReceipts: boolean;
  notificationsEnabled: boolean;
  blockedUsers: string[];
}
