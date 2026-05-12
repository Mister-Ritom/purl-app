import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Message } from './message';
import { UserProfile } from './user';

export interface Conversation {
  id: string;
  participants: string[];
  isGroup: boolean;
  groupName?: string;
  groupPhotoUrl?: string;
  admins?: string[];
  encryptedGroupKeys?: Record<string, { ciphertext: string; nonce: string }>;
  lastMessage?: {
    senderId: string;
    type: Message['type'];
    encryptedContent: string;
    nonce: string;
    timestamp: FirebaseFirestoreTypes.Timestamp;
  };
  createdAt: FirebaseFirestoreTypes.Timestamp;
  // Derived client-side:
  otherUser?: UserProfile;
  unreadCount?: number;
  lastMessageDecrypted?: string;
}
