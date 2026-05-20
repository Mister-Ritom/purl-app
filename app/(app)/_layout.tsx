import React, { useEffect } from "react";
import { Redirect } from "expo-router";
import { withLayoutContext } from "expo-router";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { Alert } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { getImageSourceSync } from "react-native-vector-icons/Ionicons";

import { useAuthStore } from "../../src/store/authStore";
import { LoadingScreen } from "../../src/components/common/LoadingScreen";
import { useTheme } from "../../src/hooks/useTheme";
import { MMKV_INSTANCE_ID } from "../../src/utils/constants";
import {
  checkNotificationPermission,
  requestNotificationPermission,
  registerFcmToken,
} from "../../src/services/messaging";

const NativeTabs = withLayoutContext(
  createNativeBottomTabNavigator().Navigator,
);

const mmkv = createMMKV({ id: MMKV_INSTANCE_ID });

export default function AppLayout() {
  const { colors } = useTheme();
  const { user, userProfile, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading || !user || !userProfile?.username) return;

    const checkAndPromptNotifications = async () => {
      try {
        const hasPermission = await checkNotificationPermission();
        if (hasPermission) return;

        const promptKey = `has_prompted_notifications_${user.uid}`;
        const alreadyPrompted = mmkv.getBoolean(promptKey);
        if (alreadyPrompted) return;

        setTimeout(() => {
          Alert.alert(
            "Keep up with friends!",
            "Enable notifications so you receive instant alerts when your friends send you messages or start a call. Stay connected in real-time.",
            [
              {
                text: "Not Now",
                onPress: () => {
                  mmkv.set(promptKey, true);
                },
                style: "cancel",
              },
              {
                text: "Enable",
                onPress: async () => {
                  mmkv.set(promptKey, true);
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    registerFcmToken(user.uid);
                  }
                },
              },
            ],
            { cancelable: true }
          );
        }, 1500);
      } catch (error) {
        console.error("[AppLayout] Error checking/prompting for notifications:", error);
      }
    };

    checkAndPromptNotifications();
  }, [isLoading, user, userProfile]);

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
          tabBarIcon: ({ focused }) => getImageSourceSync(
            focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline",
            24,
            focused ? colors.primary : colors.textSecondary
          ),
        }}
      />

      <NativeTabs.Screen
        name="status"
        options={{
          title: "Status",
          tabBarIcon: ({ focused }) => getImageSourceSync(
            focused ? "aperture" : "aperture-outline",
            24,
            focused ? colors.primary : colors.textSecondary
          ),
        }}
      />

      <NativeTabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ focused }) => getImageSourceSync(
            focused ? "call" : "call-outline",
            24,
            focused ? colors.primary : colors.textSecondary
          ),
        }}
      />

      <NativeTabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => getImageSourceSync(
            focused ? "settings" : "settings-outline",
            24,
            focused ? colors.primary : colors.textSecondary
          ),
        }}
      />
    </NativeTabs>
  );
}
