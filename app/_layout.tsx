import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useAuthStore } from "../src/store/authStore";
import { COLORS_DARK, COLORS_LIGHT } from "../src/utils/constants";
import { usePresence } from "../src/hooks/usePresence";
import { configureGoogleSignIn } from "../src/services/auth";
import { getOrCreateKeyPair } from "../src/services/encryption";
import {
  setupNotifeeChannels,
  setupMessaging,
  setupNotifeeListeners,
  registerFcmToken,
} from "../src/services/messaging";
import { setupDeepLinkHandler } from "../src/services/deeplink";
import { LoadingScreen } from "../src/components/common/LoadingScreen";
import { IncomingCallOverlay } from "../src/components/call/IncomingCallOverlay";

// Firestore persistence is enabled by default in React Native Firebase

export default function RootLayout() {
  const { isLoading, setUser, setUserProfile, setKeyPair, setLoading } =
    useAuthStore();

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
        const userDocRef = doc(getFirestore(), "users", firebaseUser.uid);
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
          console.error("[RootLayout] Failed to load key pair:", e);
        }
      } else {
        setUserProfile(null);
        setKeyPair(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const theme = scheme === 'dark' ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: COLORS_DARK.background,
      card: COLORS_DARK.surface,
      text: COLORS_DARK.text,
      border: COLORS_DARK.border,
      primary: COLORS_DARK.primary,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: COLORS_LIGHT.background,
      card: COLORS_LIGHT.surface,
      text: COLORS_LIGHT.text,
      border: COLORS_LIGHT.border,
      primary: COLORS_LIGHT.primary,
    },
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            {/* Sits above the native tab layer — tab bar never shows here */}
            <Stack.Screen
              name="chats/[convId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="call/[callId]"
              options={{ presentation: "fullScreenModal" }}
            />
            <Stack.Screen
              name="invite/scan"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="invite/create"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="profile/[uid]" />
            <Stack.Screen
              name="profile/edit"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="search/index"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="contacts/index"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="group/create"
              options={{ presentation: "modal" }}
            />
          </Stack>
          <IncomingCallOverlay />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
