import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import { UserProfile } from '../types/user';
import * as FileSystem from 'expo-file-system/legacy';

// --- USER ---
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await firestore().collection('users').doc(uid).get();
  if (!doc.exists()) return null;
  return { id: doc.id, ...doc.data() } as unknown as UserProfile;
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await firestore().collection('users').doc(uid).update(data);
}

// --- USERNAME ---
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const doc = await firestore().collection('usernames').doc(username.toLowerCase()).get();
  return !doc.exists();
}

// --- CONVERSATIONS ---
export function subscribeToConversations(
  uid: string,
  onData: (convs: Conversation[]) => void
): () => void {
  return firestore()
    .collection('conversations')
    .where('participants', 'array-contains', uid)
    .orderBy('lastMessage.timestamp', 'desc')
    .onSnapshot((snapshot) => {
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
  const ref = await firestore().collection('conversations').add({
    participants,
    isGroup,
    createdAt: firestore.FieldValue.serverTimestamp(),
    lastMessage: null,
    ...(groupData ?? {}),
  });
  return ref.id;
}

export async function findConversationBetween(uid1: string, uid2: string): Promise<string | null> {
  const snap = await firestore()
    .collection('conversations')
    .where('participants', 'array-contains', uid1)
    .where('isGroup', '==', false)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.participants.includes(uid2)) return doc.id;
  }
  return null;
}

// --- MESSAGES ---
export function subscribeToMessages(
  convId: string,
  limit: number,
  onData: (msgs: Message[]) => void
): () => void {
  return firestore()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .onSnapshot((snapshot) => {
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
  const ref = await firestore()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .add(message);

  await firestore().collection('conversations').doc(convId).update({
    lastMessage: {
      senderId: message.senderId,
      type: message.type,
      encryptedContent: message.encryptedContent,
      nonce: message.nonce,
      timestamp: firestore.FieldValue.serverTimestamp(),
    },
  });

  return ref.id;
}

export async function markMessagesRead(
  convId: string,
  msgIds: string[],
  uid: string
): Promise<void> {
  const batch = firestore().batch();
  msgIds.forEach((id) => {
    const ref = firestore()
      .collection('conversations')
      .doc(convId)
      .collection('messages')
      .doc(id);
    batch.update(ref, {
      [`readBy.${uid}`]: firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function deleteMessageForMe(
  convId: string,
  msgId: string,
  uid: string
): Promise<void> {
  await firestore()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(msgId)
    .update({ deletedFor: firestore.FieldValue.arrayUnion(uid) });
}

export async function deleteMessageForEveryone(
  convId: string,
  msgId: string
): Promise<void> {
  await firestore()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(msgId)
    .update({
      deletedForEveryone: true,
      encryptedContent: '',
      nonce: '',
      mediaUrl: null,
    });
}

export async function addReaction(
  convId: string,
  msgId: string,
  uid: string,
  emoji: string
): Promise<void> {
  await firestore()
    .collection('conversations')
    .doc(convId)
    .collection('messages')
    .doc(msgId)
    .update({ [`reactions.${uid}`]: emoji });
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

  const ref = storage().ref(`media/${convId}/${fileName}`);
  const task = ref.putFile(tempPath);

  if (onProgress) {
    task.on('state_changed', (snapshot) => {
      onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
    });
  }

  await task;
  await FileSystem.deleteAsync(tempPath, { idempotent: true });
  return await ref.getDownloadURL();
}

// --- TYPING ---
export async function setTypingIndicator(
  convId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  const ref = firestore()
    .collection('conversations')
    .doc(convId)
    .collection('typing')
    .doc(uid);

  if (isTyping) {
    await ref.set({ uid, timestamp: firestore.FieldValue.serverTimestamp() });
  } else {
    await ref.delete();
  }
}

export function subscribeToTyping(
  convId: string,
  currentUid: string,
  onData: (typingUids: string[]) => void
): () => void {
  return firestore()
    .collection('conversations')
    .doc(convId)
    .collection('typing')
    .onSnapshot((snap) => {
      if (!snap || !snap.docs) {
        onData([]);
        return;
      }
      const uids = snap.docs
        .map((d) => d.id)
        .filter((id) => id !== currentUid);
      onData(uids);
    });
}

// --- DIRECT CONVERSATION HELPERS ---
export async function getOrCreateDirectConversation(uid1: string, uid2: string): Promise<string> {
  const existing = await findConversationBetween(uid1, uid2);
  if (existing) return existing;
  return createConversation([uid1, uid2], false);
}

// --- AVATAR UPLOAD ---
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const ref = storage().ref(`avatars/${uid}/avatar.jpg`);
  await ref.putFile(localUri);
  const url = await ref.getDownloadURL();
  await firestore().collection('users').doc(uid).update({ photoURL: url });
  return url;
}
