import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface StatusItem {
  id: string;
  uid: string;
  type: 'text' | 'image' | 'video';
  encryptedContent: string;
  nonce: string;
  mediaUrl?: string;
  backgroundColor?: string;
  viewedBy: string[];
  privacy: 'everyone' | 'contacts' | 'nobody' | 'custom';
  customPrivacyList?: string[];
  createdAt: FirebaseFirestoreTypes.Timestamp;
  expiresAt: FirebaseFirestoreTypes.Timestamp;
}
