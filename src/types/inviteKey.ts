import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface InviteKey {
  id: string;
  token: string;
  label: string;
  type: 'single' | 'multi' | 'permanent';
  usesAllowed: number | null;
  usesConsumed: number;
  expiresAt: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  isActive: boolean;
  usedBy: string[];
}
