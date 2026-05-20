import { create } from 'zustand';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';

interface ChatStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  sharedSecretCache: Record<string, Uint8Array>;
  groupKeyCache: Record<string, Uint8Array>;
  activeConvId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addMessages: (convId: string, msgs: Message[]) => void;
  prependMessages: (convId: string, msgs: Message[]) => void;
  updateMessage: (convId: string, msgId: string, update: Partial<Message>) => void;
  cacheSharedSecret: (uid: string, secret: Uint8Array) => void;
  getSharedSecretFromCache: (uid: string) => Uint8Array | undefined;
  cacheGroupKey: (convId: string, key: Uint8Array) => void;
  getGroupKeyFromCache: (convId: string) => Uint8Array | undefined;
  setActiveConvId: (id: string | null) => void;
  clearMessages: (convId: string) => void;
  removeMessage: (convId: string, msgId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  messages: {},
  sharedSecretCache: {},
  groupKeyCache: {},
  activeConvId: null,
  setConversations: (convs) => set({ conversations: convs }),
  addMessages: (convId, msgs) =>
    set((state) => {
      const existing = state.messages[convId] ?? [];
      const existingOptimistic = existing.filter(m => m.isOptimistic);
      
      // Merge local states (decryptedContent, isError, localCacheUri) to prevent them being wiped out by Firestore syncs
      const mergedMsgs = msgs.map(incoming => {
        const old = existing.find(m => m.id === incoming.id);
        if (old) {
          return {
            ...incoming,
            decryptedContent: old.decryptedContent ?? incoming.decryptedContent,
            isError: old.isError ?? incoming.isError,
            mediaItems: incoming.mediaItems?.map((incomingMedia, i) => {
              const oldMedia = old.mediaItems?.[i];
              return {
                ...incomingMedia,
                localCacheUri: oldMedia?.localCacheUri ?? incomingMedia.localCacheUri
              };
            })
          };
        }
        return incoming;
      });
      
      return {
        messages: {
          ...state.messages,
          [convId]: [...existingOptimistic.filter(om => !mergedMsgs.some(m => m.id === om.id)), ...mergedMsgs],
        },
      };
    }),
  prependMessages: (convId, msgs) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: [...msgs, ...(state.messages[convId] ?? [])],
      },
    })),
  updateMessage: (convId, msgId, update) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] ?? []).map((m) =>
          m.id === msgId ? { ...m, ...update } : m
        ),
      },
    })),
  cacheSharedSecret: (uid, secret) =>
    set((state) => ({
      sharedSecretCache: { ...state.sharedSecretCache, [uid]: secret },
    })),
  getSharedSecretFromCache: (uid) => get().sharedSecretCache[uid],
  cacheGroupKey: (convId, key) =>
    set((state) => ({
      groupKeyCache: { ...state.groupKeyCache, [convId]: key },
    })),
  getGroupKeyFromCache: (convId) => get().groupKeyCache[convId],
  setActiveConvId: (id) => set({ activeConvId: id }),
  clearMessages: (convId) =>
    set((state) => {
      const { [convId]: _, ...rest } = state.messages;
      return { messages: rest };
    }),
  removeMessage: (convId, msgId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] ?? []).filter((m) => m.id !== msgId),
      },
    })),
}));
