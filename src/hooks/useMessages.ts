import { useEffect, useState, useRef } from 'react';
import { subscribeToMessages, markMessagesRead } from '../services/firestore';
import { decryptMessage, decryptWithGroupKey } from '../services/encryption';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import { MESSAGES_PER_PAGE } from '../utils/constants';
import * as FileSystem from 'expo-file-system';
import { getCachedFilePath, isCached } from '../utils/mediaHelpers';

export function useMessages(convId: string, conversation: Conversation | null) {
  const { keyPair } = useAuthStore();
  const { messages, addMessages, updateMessage, getGroupKeyFromCache, getSharedSecretFromCache } = useChatStore();
  const uid = useAuthStore((s) => s.user?.uid);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const decrypt = (msg: Message): Message => {
    if (!keyPair || !conversation) return msg;
    try {
      let decryptedContent: string | null = null;
      if (conversation.isGroup) {
        const groupKey = getGroupKeyFromCache(convId);
        if (groupKey) {
          decryptedContent = decryptWithGroupKey(groupKey, msg.encryptedContent, msg.nonce);
        }
      } else {
        const otherUid = conversation.participants.find((p) => p !== uid);
        if (otherUid) {
          const secret = getSharedSecretFromCache(otherUid);
          if (secret) {
            decryptedContent = decryptMessage(secret, msg.encryptedContent, msg.nonce);
          }
        }
      }
      return { ...msg, decryptedContent: decryptedContent ?? undefined };
    } catch {
      return msg;
    }
  };

  useEffect(() => {
    if (!convId) return;
    setLoading(true);

    const unsub = subscribeToMessages(convId, MESSAGES_PER_PAGE, (msgs) => {
      const decrypted = msgs.map(decrypt);
      addMessages(convId, decrypted);
      setLoading(false);

      // Mark visible messages as read
      if (uid) {
        const unreadIds = msgs
          .filter((m) => m.senderId !== uid && !m.readBy?.[uid])
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          markMessagesRead(convId, unreadIds, uid).catch(() => {});
        }
      }
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [convId]);

  return {
    messages: messages[convId] ?? [],
    loading,
  };
}
