import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'call_log';

export interface Message {
  id: string;
  senderId: string;
  type: MessageType;
  encryptedContent: string;
  nonce: string;
  decryptedContent?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  mediaFileName?: string;
  mediaDuration?: number;
  replyToId?: string;
  replyToMessage?: Message;
  reactions: Record<string, string>;
  readBy: Record<string, FirebaseFirestoreTypes.Timestamp>;
  deletedFor: string[];
  deletedForEveryone: boolean;
  timestamp: FirebaseFirestoreTypes.Timestamp;
  localCacheUri?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  isSending?: boolean;
  sendFailed?: boolean;
}
