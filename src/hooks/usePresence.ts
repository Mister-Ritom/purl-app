import { useEffect } from 'react';
import { initPresence } from '../services/presence';
import { useAuthStore } from '../store/authStore';

export function usePresence() {
  const uid = useAuthStore((s) => s.user?.uid);

  useEffect(() => {
    if (!uid) return;
    const cleanup = initPresence(uid);
    return cleanup;
  }, [uid]);
}
