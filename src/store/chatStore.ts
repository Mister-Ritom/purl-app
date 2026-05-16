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
      const existingOptimistic = (state.messages[convId] ?? []).filter(m => m.isOptimistic);
      // Filter out optimistic messages that are now present in the new msgs list (by checking some unique prop if possible, but for now we just keep them if they are not in msgs)
      // Since optimistic IDs are temp_... and Firestore IDs are random, we can't easily match them without a correlation ID.
      // However, we can just keep them. If they are marked isOptimistic: false elsewhere, they will be dropped next time if not in msgs.
      
      return {
        messages: {
          ...state.messages,
          [convId]: [...existingOptimistic.filter(om => !msgs.some(m => m.id === om.id)), ...msgs],
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
}));
