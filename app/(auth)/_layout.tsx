import React from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { LoadingScreen } from '../../src/components/common/LoadingScreen';

export default function AuthLayout() {
  const { user, userProfile, isLoading } = useAuthStore();
  const segments = useSegments();

  if (isLoading) return <LoadingScreen />;

  // If user is fully logged in with a username, redirect to the main app
  if (user && userProfile?.username) {
    return <Redirect href="/(app)/chats" />;
  }

  // If user is logged in but missing a username, ensure they are on the username screen
  // We check the segments to avoid infinite redirect loops
  const isOnUsernameScreen = (segments as any).includes('username');
  if (user && !userProfile?.username && !isOnUsernameScreen) {
    return <Redirect href="/(auth)/username" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="username" />
    </Stack>
  );
}
