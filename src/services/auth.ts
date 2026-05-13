import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getAuth, signInWithCredential, signOut as firebaseSignOut, GoogleAuthProvider } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, writeBatch, serverTimestamp } from '@react-native-firebase/firestore';
import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';
import { router } from 'expo-router';
import { getOrCreateKeyPair, clearSharedSecretCache } from './encryption';
import { useAuthStore } from '../store/authStore';
import { KEYCHAIN_SERVICE_ENCRYPTION, MMKV_INSTANCE_ID } from '../utils/constants';

const mmkv = createMMKV({ id: MMKV_INSTANCE_ID });

const WEB_CLIENT_ID =
  '955786749612-1vrqrnfm4iag9nlppgiti7hpa71s4jda.apps.googleusercontent.com';

const IOS_CLIENT_ID =
  '955786749612-2difsmgsqa7hfp32cgmql6qk3qr6g8cb.apps.googleusercontent.com';

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: true,
  });
}

export async function signInWithGoogle(): Promise<void> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
    if (!idToken) throw new Error('No ID token returned from Google Sign-In');

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(getAuth(), credential);
    const uid = result.user.uid;

    const userDocRef = doc(getFirestore(), 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      router.replace('/(auth)/username');
    } else {
      const keyPair = await getOrCreateKeyPair(uid);
      useAuthStore.getState().setKeyPair(keyPair);
      await registerFCMToken(uid);
      router.replace('/(app)/chats');
    }
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
    if (error.code === statusCodes.IN_PROGRESS) return;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {}
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE_ENCRYPTION });
  } catch {}
  clearSharedSecretCache();
  mmkv.clearAll();

  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUserProfile(null);
  useAuthStore.getState().setKeyPair(null);

  await firebaseSignOut(getAuth());
  router.replace('/(auth)/welcome');
}

export async function registerFCMToken(uid: string): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (!token) return;
    const userRef = doc(getFirestore(), 'users', uid);
    await updateDoc(userRef, { fcmToken: token });

    onTokenRefresh(getMessaging(), async (newToken) => {
      try {
        await updateDoc(userRef, { fcmToken: newToken });
      } catch (e) {
        console.warn('FCM token refresh update failed:', e);
      }
    });
  } catch (e: any) {
    // Gracefully handle "No APNS token" which happens on iOS simulator
    if (e.message?.includes('APNS') || e.code?.includes('apns')) {
      console.log('Skipping FCM token: APNS not ready (likely simulator)');
    } else {
      console.warn('FCM token registration failed:', e);
    }
  }
}

export async function completeOnboarding(
  uid: string,
  username: string,
  displayName: string
): Promise<void> {
  const batch = writeBatch(getFirestore());

  const userRef = doc(getFirestore(), 'users', uid);
  const usernameRef = doc(getFirestore(), 'usernames', username.toLowerCase());

  const keyPair = await getOrCreateKeyPair(uid);
  const { encodeBase64 } = await import('tweetnacl-util');

  const defaultSettings = {
    lastSeenVisibility: 'everyone',
    photoVisibility: 'everyone',
    aboutVisibility: 'everyone',
    statusVisibility: 'everyone',
    readReceipts: true,
    notificationsEnabled: true,
    blockedUsers: [],
  };

  batch.set(userRef, {
    uid,
    username: username.toLowerCase(),
    displayName,
    photoURL: '',
    about: '',
    publicKey: encodeBase64(keyPair.publicKey),
    isOnline: true,
    lastSeen: serverTimestamp(),
    fcmToken: '',
    settings: defaultSettings,
    createdAt: serverTimestamp(),
  });

  batch.set(usernameRef, { uid, username: username.toLowerCase() });

  await batch.commit();

  useAuthStore.getState().setKeyPair(keyPair);
  await registerFCMToken(uid);
}
