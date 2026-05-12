import { useEffect, useState, useRef } from 'react';
import { subscribeToMessages, markMessagesRead } from '../services/firestore';
import { decryptMessage, decryptWithGroupKey } from '../services/encryption';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import { MESSAGES_PER_PAGE } from '../utils/constants';
import * as FileSystem from 'expo-file-system';
import { getCachedFilePath, isCached, getMimeTypeExtension } from '../utils/mediaHelpers';
import { decryptFile } from '../services/encryption';

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
      let key: Uint8Array | null = null;

      if (conversation.isGroup) {
        key = getGroupKeyFromCache(convId) || null;
        if (key) {
          decryptedContent = decryptWithGroupKey(key, msg.encryptedContent, msg.nonce);
        }
      } else {
        const otherUid = conversation.participants.find((p) => p !== uid);
        if (otherUid) {
          key = getSharedSecretFromCache(otherUid) || null;
          if (key) {
            decryptedContent = decryptMessage(key, msg.encryptedContent, msg.nonce);
          }
        }
      }

      // Start background processing for all media
      if (key && msg.mediaItems?.some(i => !i.localCacheUri)) {
        processMedia(msg, key);
      }

      return { ...msg, decryptedContent: decryptedContent ?? undefined };
    } catch {
      return msg;
    }
  };

  const processMedia = async (msg: Message, key: Uint8Array) => {
    try {
      // Process batch media
      if (msg.mediaItems && msg.mediaItems.length > 0) {
        const updatedItems = [...msg.mediaItems];
        let changed = false;

        for (let i = 0; i < updatedItems.length; i++) {
          const item = updatedItems[i];
          if (!item.localCacheUri) {
            const ext = getMimeTypeExtension(item.mimeType);
            const cachePath = await getCachedFilePath(convId, msg.id + `_${i}`, ext);
            const decryptedUri = await downloadAndDecrypt(item.url, item.nonce, key, cachePath);
            if (decryptedUri) {
              updatedItems[i].localCacheUri = decryptedUri;
              changed = true;
            }
          }
        }

        if (changed) {
          updateMessage(convId, msg.id, { mediaItems: updatedItems });
        }
      }
    } catch (error) {
      console.error('[useMessages] Error processing media:', error);
    }
  };

  const downloadAndDecrypt = async (url: string, nonce: string, key: Uint8Array, cachePath: string) => {
    try {
      const exists = await isCached(url);
      if (exists) return cachePath;

      const cacheDir = FileSystem.Paths.cache.uri;
      const tempPath = `${cacheDir}${Date.now()}.enc`;
      await FileSystem.downloadAsync(url, tempPath);
      
      const decryptedUri = await decryptFile(key, tempPath, nonce, `${cacheDir}${Date.now()}.dec`);
      if (decryptedUri) {
        await FileSystem.moveAsync({ from: decryptedUri, to: cachePath });
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        return cachePath;
      }
      return null;
    } catch (e) {
      console.error('[useMessages] Download/Decrypt failed:', e);
      return null;
    }
  };

  useEffect(() => {
    if (!convId) return;
    setLoading(true);

    const unsub = subscribeToMessages(convId, MESSAGES_PER_PAGE, (msgs) => {
      const decrypted = msgs.map(decrypt);
      addMessages(convId, decrypted);
      setLoading(false);

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
  }, [convId, conversation]); // Added conversation to deps

  return {
    messages: messages[convId] ?? [],
    loading,
  };
}
