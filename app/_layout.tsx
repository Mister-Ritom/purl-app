import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { useAuthStore } from '../src/store/authStore';
import { usePresence } from '../src/hooks/usePresence';
import { configureGoogleSignIn } from '../src/services/auth';
import { getOrCreateKeyPair } from '../src/services/encryption';
import { setupNotifeeChannels, setupMessaging, setupNotifeeListeners, registerFcmToken } from '../src/services/messaging';
import { setupDeepLinkHandler } from '../src/services/deeplink';
import { LoadingScreen } from '../src/components/common/LoadingScreen';
import { IncomingCallOverlay } from '../src/components/call/IncomingCallOverlay';

// Firestore persistence is enabled by default in React Native Firebase


export default function RootLayout() {
  const { user, isLoading, setUser, setUserProfile, setKeyPair, setLoading } = useAuthStore();

  usePresence();

  useEffect(() => {
    configureGoogleSignIn();
    setupNotifeeChannels();
    setupMessaging();
    const cleanupNotifee = setupNotifeeListeners();
    const cleanupDeepLink = setupDeepLinkHandler();

    return () => {
      cleanupNotifee();
      cleanupDeepLink();
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        registerFcmToken(firebaseUser.uid);
        const userDocRef = doc(getFirestore(), 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as any);
        } else {
          setUserProfile(null);
        }
        // Always load the encryption key pair on session restore
        try {
          const kp = await getOrCreateKeyPair(firebaseUser.uid);
          setKeyPair(kp);
        } catch (e) {
          console.error('[RootLayout] Failed to load key pair:', e);
        }
      } else {
        setUserProfile(null);
        setKeyPair(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          {/* Sits above the native tab layer — tab bar never shows here */}
          <Stack.Screen name="chats/[convId]" options={{ headerShown: false }} />
          <Stack.Screen name="call/[callId]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="invite/scan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile/[uid]" />
          <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="search/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="group/create" options={{ presentation: 'modal' }} />
        </Stack>
        <IncomingCallOverlay />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
