import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'call_log' | 'media';

export interface MediaItem {
  url: string;
  mimeType: string;
  nonce: string;
  size?: number | null;
  fileName?: string | null;
  duration?: number | null;
  localCacheUri?: string;
}

export interface Message {
  id: string;
  senderId: string;
  type: MessageType;
  encryptedContent: string;
  nonce: string;
  decryptedContent?: string;
  mediaItems?: MediaItem[];
  replyToId?: string;
  replyToMessage?: Message;
  reactions: Record<string, string>;
  readBy: Record<string, FirebaseFirestoreTypes.Timestamp>;
  deletedFor: string[];
  deletedForEveryone: boolean;
  timestamp: FirebaseFirestoreTypes.Timestamp;
  isOptimistic?: boolean;
  isError?: boolean;
}
