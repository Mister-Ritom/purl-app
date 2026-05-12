import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { InviteKey } from '../types/inviteKey';

export function useInviteKeys() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [keys, setKeys] = useState<InviteKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('users')
      .doc(uid)
      .collection('inviteKeys')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InviteKey[];
        setKeys(data);
        setLoading(false);
      });
    return () => unsub();
  }, [uid]);

  return { keys, loading };
}
