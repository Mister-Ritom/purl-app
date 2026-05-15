import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  remove,
  onDisconnect, 
  serverTimestamp as databaseTimestamp
} from '@react-native-firebase/database';
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
    }
  });

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      set(presenceRef, { online: true });
    } else {
      set(presenceRef, {
        online: false,
        lastSeen: databaseTimestamp(),
      });
    }
  });

  return () => {
    connectedListener();
    appStateSubscription?.remove();
    presenceInitialized = false;
  };
}

// --- Typing Indicators ---

export function setTypingStatus(convId: string, uid: string, isTyping: boolean) {
  const typingRef = ref(getDatabase(), `typing/${convId}/${uid}`);
  if (isTyping) {
    set(typingRef, true);
    onDisconnect(typingRef).remove();
  } else {
    remove(typingRef);
  }
}

export function subscribeToTyping(convId: string, currentUid: string, onData: (typingUids: string[]) => void): () => void {
  const typingRef = ref(getDatabase(), `typing/${convId}`);
  return onValue(typingRef, (snap) => {
    const val = snap.val();
    if (!val) {
      onData([]);
      return;
    }
    const uids = Object.keys(val).filter(uid => uid !== currentUid);
    onData(uids);
  });
}

// --- Presence Reading ---

export interface UserStatus {
  online: boolean;
  lastSeen?: number;
}

export function subscribeToUserStatus(uid: string, onData: (status: UserStatus) => void): () => void {
  const presenceRef = ref(getDatabase(), `presence/${uid}`);
  return onValue(presenceRef, (snap) => {
    const val = snap.val();
    onData(val || { online: false });
  });
}

