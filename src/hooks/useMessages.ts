import { useEffect, useState, useRef, useMemo } from 'react';
import { subscribeToMessages, markMessagesRead } from '../services/firestore';
import { decryptMessage, decryptWithGroupKey } from '../services/encryption';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import { MESSAGES_PER_PAGE } from '../utils/constants';
import * as FileSystem from 'expo-file-system/legacy';
import { getCachedFilePath, isCached, getMimeTypeExtension } from '../utils/mediaHelpers';
import { decryptFile } from '../services/encryption';

export function useMessages(convId: string, conversation: Conversation | null) {
  const { keyPair } = useAuthStore();
  const { messages: allMessages, addMessages, updateMessage } = useChatStore();
  const sharedSecretCache = useChatStore(s => s.sharedSecretCache);
  const groupKeyCache = useChatStore(s => s.groupKeyCache);
  const uid = useAuthStore((s) => s.user?.uid);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const processingRef = useRef<Set<string>>(new Set());

  const rawMessages = allMessages[convId] ?? [];

  const decrypt = (msg: Message): Message => {
    if (!keyPair || !conversation) return msg;
    if (msg.decryptedContent || msg.isOptimistic || !msg.encryptedContent) return msg; 
    if (msg.isError) {
      return { ...msg, decryptedContent: "🔒 Decryption failed" };
    }
    
    try {
      let decryptedContent: string | null = null;
      let key: Uint8Array | null = null;

      if (conversation.isGroup) {
        key = groupKeyCache[convId] || null;
        if (key) {
          decryptedContent = decryptWithGroupKey(key, msg.encryptedContent, msg.nonce);
          if (decryptedContent === null) {
            msg.isError = true;
            msg.decryptedContent = "🔒 Decryption failed";
          }
        }
      } else {
        const otherUid = conversation.participants.find((p) => p !== uid);
        if (otherUid) {
          key = sharedSecretCache[otherUid] || null;
          if (key) {
            decryptedContent = decryptMessage(key, msg.encryptedContent, msg.nonce);
            if (decryptedContent === null) {
              msg.isError = true;
              msg.decryptedContent = "🔒 Decryption failed";
            }
          }
        }
      }

      if (decryptedContent !== null) {
        msg.decryptedContent = decryptedContent;
      }

      return { ...msg, decryptedContent: msg.decryptedContent, isError: msg.isError };
    } catch (e) {
      console.warn('[useMessages] Decryption failed for message:', msg.id, e);
      msg.isError = true;
      msg.decryptedContent = "🔒 Decryption failed";
      return { ...msg, decryptedContent: msg.decryptedContent, isError: true };
    }
  };

  const processedMessages = useMemo(() => {
    return rawMessages.map(decrypt);
  }, [rawMessages, groupKeyCache, sharedSecretCache, conversation]);

  useEffect(() => {
    if (!keyPair || !conversation || processedMessages.length === 0) return;

    const messagesWithPendingMedia = processedMessages.filter(
      m => m.mediaItems && m.mediaItems.length > 0 && m.mediaItems.some(i => !i.localCacheUri)
    );

    if (messagesWithPendingMedia.length === 0) return;

    let key: Uint8Array | null = null;
    if (conversation.isGroup) {
      key = groupKeyCache[convId] || null;
    } else {
      const otherUid = conversation.participants.find((p) => p !== uid);
      if (otherUid) {
        key = sharedSecretCache[otherUid] || null;
      }
    }

    if (!key) return;
    
    const currentKey = key;
    messagesWithPendingMedia.forEach(msg => {
      if (processingRef.current.has(msg.id)) return;
      processingRef.current.add(msg.id);
      
      processMedia(msg, currentKey).finally(() => {
        processingRef.current.delete(msg.id);
      });
    });
  }, [processedMessages, keyPair, conversation, groupKeyCache, sharedSecretCache]);

  const processMedia = async (msg: Message, key: Uint8Array) => {
    try {
      if (msg.mediaItems && msg.mediaItems.length > 0) {
        const updatedItems = [...msg.mediaItems];
        let changed = false;

        for (let i = 0; i < updatedItems.length; i++) {
          const item = updatedItems[i];
          if (!item.localCacheUri) {
            const ext = getMimeTypeExtension(item.mimeType);
            const cachePath = await getCachedFilePath(convId, msg.id + `_${i}`, ext);
            
            // Check if already decrypted and cached
            const cached = await isCached(cachePath);
            if (cached) {
              updatedItems[i].localCacheUri = cachePath;
              changed = true;
              continue;
            }

            const encryptionData = item.mediaEncryption || item.nonce || '';
            const decryptedUri = await downloadAndDecrypt(item.url, encryptionData, key, cachePath);
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

  const downloadAndDecrypt = async (url: string, encryptionData: any, key: Uint8Array, cachePath: string) => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return null;

      const tempPath = `${cacheDir}${Date.now()}_${Math.random().toString(36).substring(7)}.enc`;
      
      // Download the encrypted file
      const downloadResult = await FileSystem.downloadAsync(url, tempPath);
      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
      
      const decryptedTempPath = `${cacheDir}${Date.now()}_${Math.random().toString(36).substring(7)}.dec`;
      const decryptedUri = await decryptFile(key, tempPath, encryptionData, decryptedTempPath);
      
      if (decryptedUri) {
        await FileSystem.moveAsync({ from: decryptedUri, to: cachePath });
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        return cachePath;
      }
      
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
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
      // Add raw messages to store; useMemo will handle decryption reactively
      addMessages(convId, msgs);
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
  }, [convId, uid]);

  return {
    messages: processedMessages,
    loading,
  };
}
