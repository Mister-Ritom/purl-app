import { useEffect, useRef, useState } from 'react';
import { subscribeToTyping, setTypingStatus } from '../services/presence';
import { useAuthStore } from '../store/authStore';
import { TYPING_TIMEOUT_MS } from '../utils/constants';

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
        setTypingStatus(convId, uid, false);
      }
    };
  }, [convId, uid]);

  const onTyping = () => {
    if (!uid || !convId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTypingStatus(convId, uid, true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setTypingStatus(convId, uid, false);
    }, TYPING_TIMEOUT_MS);
  };

  const onStopTyping = () => {
    if (!uid || !convId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTypingStatus(convId, uid, false);
    }
  };

  return { typingUids, onTyping, onStopTyping };
}

