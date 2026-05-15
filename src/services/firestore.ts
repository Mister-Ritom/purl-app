import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit as firestoreLimit, 
  writeBatch, 
  serverTimestamp, 
  arrayUnion,
  getDocs,
  increment
} from '@react-native-firebase/firestore';
import { getStorage, ref as storageRef, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import { UserProfile } from '../types/user';
import * as FileSystem from 'expo-file-system/legacy';

// --- USER ---
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const userDocRef = doc(getFirestore(), 'users', uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) return null;
  return { id: userDoc.id, ...userDoc.data() } as unknown as UserProfile;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const userDocRef = doc(getFirestore(), 'users', uid);
  await updateDoc(userDocRef, data);
}

// --- USERNAME ---
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const usernameDocRef = doc(getFirestore(), 'usernames', username.toLowerCase());
  const usernameDoc = await getDoc(usernameDocRef);
  return !usernameDoc.exists();
}

// --- CONVERSATIONS ---
export function subscribeToConversations(
  uid: string,
  onData: (convs: Conversation[]) => void
): () => void {
  const q = query(
    collection(getFirestore(), 'conversations'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessage.timestamp', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    if (!snapshot || !snapshot.docs) {
      onData([]);
      return;
    }
    const convs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Conversation[];
    onData(convs);
  });
}

export async function createConversation(
  participants: string[],
  isGroup: boolean,
  groupData?: { groupName: string; groupPhotoUrl?: string; admins: string[]; encryptedGroupKeys: Record<string, { ciphertext: string; nonce: string }> }
): Promise<string> {
  const convsRef = collection(getFirestore(), 'conversations');
  const docRef = await addDoc(convsRef, {
    participants,
    isGroup,
    createdAt: serverTimestamp(),
    lastMessage: null,
    ...(groupData ?? {}),
  });
  return docRef.id;
}

export async function findConversationBetween(uid1: string, uid2: string): Promise<string | null> {
  const q = query(
    collection(getFirestore(), 'conversations'),
    where('participants', 'array-contains', uid1),
    where('isGroup', '==', false)
  );
  const snap = await getDocs(q);

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.participants.includes(uid2)) return doc.id;
  }
  return null;
}

// --- MESSAGES ---
export function subscribeToMessages(
  convId: string,
  limitCount: number,
  onData: (msgs: Message[]) => void
): () => void {
  const q = query(
    collection(getFirestore(), 'conversations', convId, 'messages'),
    orderBy('timestamp', 'desc'),
    firestoreLimit(limitCount)
  );
  return onSnapshot(q, (snapshot) => {
    if (!snapshot || !snapshot.docs) {
      onData([]);
      return;
    }
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
    onData(msgs);
  });
}

export async function sendMessage(
  convId: string,
  message: Omit<Message, 'id'>
): Promise<string> {
  const messagesRef = collection(getFirestore(), 'conversations', convId, 'messages');
  const docRef = await addDoc(messagesRef, message);

  const convRef = doc(getFirestore(), 'conversations', convId);
  const convSnap = await getDoc(convRef);
  const participants = convSnap.exists() ? (convSnap.data()?.participants as string[] || []) : [];
  
  const unreadUpdates: Record<string, any> = {};
  participants.forEach(p => {
    if (p !== message.senderId) {
      unreadUpdates[`unreadCounts.${p}`] = increment(1);
    }
  });

  await updateDoc(convRef, {
    lastMessage: {
      senderId: message.senderId,
      type: message.type,
      encryptedContent: message.encryptedContent,
      nonce: message.nonce,
      timestamp: serverTimestamp(),
    },
    ...unreadUpdates
  });

  return docRef.id;
}

export async function markMessagesRead(
  convId: string,
  msgIds: string[],
  uid: string
): Promise<void> {
  const batch = writeBatch(getFirestore());
  
  // Reset conversation unread count
  const convRef = doc(getFirestore(), 'conversations', convId);
  batch.update(convRef, {
    [`unreadCounts.${uid}`]: 0
  });

  msgIds.forEach((id) => {
    const msgRef = doc(getFirestore(), 'conversations', convId, 'messages', id);
    batch.update(msgRef, {
      [`readBy.${uid}`]: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function resetUnreadCount(convId: string, uid: string): Promise<void> {
  const convRef = doc(getFirestore(), 'conversations', convId);
  await updateDoc(convRef, {
    [`unreadCounts.${uid}`]: 0
  });
}

export async function deleteMessageForMe(
  convId: string,
  msgId: string,
  uid: string
): Promise<void> {
  const msgRef = doc(getFirestore(), 'conversations', convId, 'messages', msgId);
  await updateDoc(msgRef, { deletedFor: arrayUnion(uid) });
}

export async function deleteMessageForEveryone(
  convId: string,
  msgId: string
): Promise<void> {
  const msgRef = doc(getFirestore(), 'conversations', convId, 'messages', msgId);
  await updateDoc(msgRef, {
    deletedForEveryone: true,
    encryptedContent: '',
    nonce: '',
    mediaItems: null,
  });
}

export async function addReaction(
  convId: string,
  msgId: string,
  uid: string,
  emoji: string
): Promise<void> {
  const msgRef = doc(getFirestore(), 'conversations', convId, 'messages', msgId);
  await updateDoc(msgRef, { [`reactions.${uid}`]: emoji });
}

// --- MEDIA UPLOAD ---
export async function uploadEncryptedMedia(
  convId: string,
  fileName: string,
  encryptedBytes: Uint8Array,
  onProgress?: (p: number) => void
): Promise<string> {
  const tempPath = `${FileSystem.cacheDirectory}upload_${Date.now()}.enc`;
  const { encodeBase64 } = await import('tweetnacl-util');
  await FileSystem.writeAsStringAsync(tempPath, encodeBase64(encryptedBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  const storageRefPath = storageRef(getStorage(), `media/${convId}/${fileName}`);
  const task = putFile(storageRefPath, tempPath);

  if (onProgress) {
    task.on('state_changed', (snapshot) => {
      onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
    });
  }

  await task;
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
  return await getDownloadURL(storageRefPath);
}

// --- DIRECT CONVERSATION HELPERS ---
export async function getOrCreateDirectConversation(uid1: string, uid2: string): Promise<string> {
  const existing = await findConversationBetween(uid1, uid2);
  if (existing) return existing;
  return createConversation([uid1, uid2], false);
}

export async function addMemberToGroup(
  convId: string,
  newMemberUid: string,
  encryptedKey: { ciphertext: string; nonce: string }
): Promise<void> {
  const convRef = doc(getFirestore(), 'conversations', convId);
  await updateDoc(convRef, {
    participants: arrayUnion(newMemberUid),
    [`encryptedGroupKeys.${newMemberUid}`]: encryptedKey,
  });
}

// --- AVATAR UPLOAD ---
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const avatarStorageRef = storageRef(getStorage(), `avatars/${uid}/avatar.jpg`);
  await avatarStorageRef.putFile(localUri);
  const url = await avatarStorageRef.getDownloadURL();
  const userDocRef = doc(getFirestore(), 'users', uid);
  await updateDoc(userDocRef, { photoURL: url });
  return url;
}
