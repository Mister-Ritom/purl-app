import { getFirestore, collection, query, where, orderBy, onSnapshot, limit } from '@react-native-firebase/firestore';
import { StatusItem } from '../types/status';

export function subscribeToUserStatuses(uid: string, onData: (items: StatusItem[]) => void) {
  const q = query(
    collection(getFirestore(), 'statuses', uid, 'items'),
    where('expiresAt', '>', new Date()),
    orderBy('expiresAt', 'asc')
  );

  return onSnapshot(q, (snap) => {
    if (!snap || !snap.docs) {
      onData([]);
      return;
    }
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as StatusItem[];
    onData(items);
  });
}
