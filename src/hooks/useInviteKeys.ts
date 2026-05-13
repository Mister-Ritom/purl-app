import { useState, useEffect } from 'react';
import { getFirestore, collection, doc, query, orderBy, onSnapshot, where } from '@react-native-firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { InviteKey } from '../types/inviteKey';

export function useInviteKeys() {
  const uid = useAuthStore((s) => s.user?.uid);
  const [keys, setKeys] = useState<InviteKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const db = getFirestore();
    const q = query(
      collection(db, 'inviteKeys'),
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap) return;
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InviteKey[];
      setKeys(data);
      setLoading(false);
    }, (error) => {
      console.error('[useInviteKeys] Snapshot error:', error);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { keys, loading };
}
