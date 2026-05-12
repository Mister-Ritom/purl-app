import { useEffect, useRef } from 'react';
import { subscribeToConversations } from '../services/firestore';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

export function useConversations() {
  const uid = useAuthStore((s) => s.user?.uid);
  const { setConversations, conversations } = useChatStore();
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConversations(uid, (convs) => {
      setConversations(convs);
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [uid]);

  return conversations;
}
