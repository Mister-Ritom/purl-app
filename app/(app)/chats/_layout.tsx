import React from 'react';
import { Stack } from 'expo-router';
import { COLORS } from '../../../src/utils/constants';

export default function ChatsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Purl', headerShown: true }} />
      <Stack.Screen name="[convId]" options={{ headerShown: false }} />
    </Stack>
  );
}
