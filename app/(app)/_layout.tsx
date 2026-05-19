import React from "react";
import { Redirect } from "expo-router";
import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";

import { useAuthStore } from "../../src/store/authStore";
import { LoadingScreen } from "../../src/components/common/LoadingScreen";
import { useTheme } from "../../src/hooks/useTheme";

const NativeTabs = withLayoutContext(
  createNativeBottomTabNavigator().Navigator,
);

export default function AppLayout() {
  const { colors } = useTheme();
  const { user, userProfile, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (!user || !userProfile?.username)
    return <Redirect href="/(auth)/welcome" />;

  return (
    <NativeTabs
      minimizeBehavior="automatic"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <NativeTabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: () => ({
            sfSymbol: "bubble.left.and.bubble.right",
            materialSymbol: "chat",
          }),
        }}
      />

      <NativeTabs.Screen
        name="status"
        options={{
          title: "Status",
          tabBarIcon: () => ({
            sfSymbol: "circle.dashed",
            materialSymbol: "published_with_changes",
          }),
        }}
      />

      <NativeTabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: () => ({
            sfSymbol: "phone.fill",
            materialSymbol: "call",
          }),
        }}
      />

      <NativeTabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: () => ({
            sfSymbol: "gearshape.fill",
            materialSymbol: "settings",
          }),
        }}
      />
    </NativeTabs>
  );
}
