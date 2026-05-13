import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  onDisconnect, 
  serverTimestamp as databaseTimestamp
} from '@react-native-firebase/database';
import { getFirestore, doc, updateDoc, serverTimestamp as firestoreTimestamp } from '@react-native-firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';

let presenceInitialized = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function initPresence(uid: string): () => void {
  if (presenceInitialized) return () => {};
  presenceInitialized = true;

  const presenceRef = ref(getDatabase(), `presence/${uid}`);
  const connectedRef = ref(getDatabase(), '.info/connected');

  const connectedListener = onValue(connectedRef, (snap) => {
    if (snap.val()) {
      onDisconnect(presenceRef).set({ online: false, lastSeen: databaseTimestamp() });
      set(presenceRef, { online: true });

      const userDocRef = doc(getFirestore(), 'users', uid);
      updateDoc(userDocRef, { isOnline: true }).catch(() => {});
    }
  });

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    const userDocRef = doc(getFirestore(), 'users', uid);
    if (state === 'active') {
      set(presenceRef, { online: true });
      updateDoc(userDocRef, { isOnline: true }).catch(() => {});
    } else {
      set(presenceRef, {
        online: false,
        lastSeen: databaseTimestamp(),
      });
      updateDoc(userDocRef, {
        isOnline: false,
        lastSeen: firestoreTimestamp(),
      }).catch(() => {});
    }
  });

  return () => {
    connectedListener();
    appStateSubscription?.remove();
    presenceInitialized = false;
  };
}
