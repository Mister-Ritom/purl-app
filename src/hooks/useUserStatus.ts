import { useState, useEffect } from 'react';
import { UserStatus, subscribeToUserStatus } from '../services/presence';

export function useUserStatus(uid?: string) {
  const [status, setStatus] = useState<UserStatus>({ online: false });

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToUserStatus(uid, setStatus);
    return unsub;
  }, [uid]);

  return status;
}
