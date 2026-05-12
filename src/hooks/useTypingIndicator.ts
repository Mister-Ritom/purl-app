import { useEffect, useRef, useState } from 'react';
import { subscribeToTyping, setTypingIndicator } from '../services/firestore';
import { useAuthStore } from '../store/authStore';
import { TYPING_DEBOUNCE_MS, TYPING_TIMEOUT_MS } from '../utils/constants';

export function useTypingIndicator(convId: string) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!convId || !uid) return;
    const unsub = subscribeToTyping(convId, uid, setTypingUids);
    return () => {
      unsub();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        setTypingIndicator(convId, uid, false).catch(() => {});
      }
    };
  }, [convId, uid]);

  const onTyping = () => {
    if (!uid || !convId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTypingIndicator(convId, uid, true).catch(() => {});
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setTypingIndicator(convId, uid, false).catch(() => {});
    }, TYPING_TIMEOUT_MS);
  };

  const onStopTyping = () => {
    if (!uid || !convId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTypingIndicator(convId, uid, false).catch(() => {});
    }
  };

  return { typingUids, onTyping, onStopTyping };
}
