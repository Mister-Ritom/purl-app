import database from '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';

let presenceInitialized = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function initPresence(uid: string): () => void {
  if (presenceInitialized) return () => {};
  presenceInitialized = true;

  const presenceRef = database().ref(`presence/${uid}`);
  const connectedRef = database().ref('.info/connected');

  const connectedListener = connectedRef.on('value', (snap) => {
    if (snap.val()) {
      presenceRef
        .onDisconnect()
        .set({ online: false, lastSeen: database.ServerValue.TIMESTAMP });
      presenceRef.set({ online: true });

      firestore().collection('users').doc(uid).update({ isOnline: true }).catch(() => {});
    }
  });

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      presenceRef.set({ online: true });
      firestore().collection('users').doc(uid).update({ isOnline: true }).catch(() => {});
    } else {
      presenceRef.set({
        online: false,
        lastSeen: database.ServerValue.TIMESTAMP,
      });
      firestore()
        .collection('users')
        .doc(uid)
        .update({
          isOnline: false,
          lastSeen: firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  });

  return () => {
    connectedRef.off('value', connectedListener as any);
    appStateSubscription?.remove();
    presenceInitialized = false;
  };
}
