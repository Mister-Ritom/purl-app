import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';

export default function ChatsLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Purl', headerShown: true }} />
    </Stack>
  );
}
