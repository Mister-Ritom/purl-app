import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useAuthStore } from '../src/store/authStore';
import { usePresence } from '../src/hooks/usePresence';
import { configureGoogleSignIn } from '../src/services/auth';
import { setupNotifeeChannels, setupMessaging, setupNotifeeListeners } from '../src/services/messaging';
import { setupDeepLinkHandler } from '../src/services/deeplink';
import { LoadingScreen } from '../src/components/common/LoadingScreen';

// Enable Firestore offline persistence
firestore().settings({ persistence: true });

export default function RootLayout() {
  const { user, isLoading, setUser, setUserProfile, setLoading } = useAuthStore();

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
    const unsub = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const doc = await firestore().collection('users').doc(firebaseUser.uid).get();
        if (doc.exists()) {
          setUserProfile(doc.data() as any);
        } else {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
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
          <Stack.Screen name="call/[callId]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="status/view/[uid]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="status/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite/scan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite/create" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile/[uid]" />
          <Stack.Screen name="profile/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="search/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="group/create" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
