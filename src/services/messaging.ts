import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { router } from 'expo-router';
import { useCallStore } from '../store/callStore';
import { Call } from '../types/call';

// ─── Background handler — MUST be registered at module level ─────────────────
// This file is imported by index.ts at the top level (before any React render),
// so this call happens before any navigator is mounted.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const data = remoteMessage?.data;
  if (!data) return;

  if (data.type === 'message') {
    await notifee.displayNotification({
      title: `@${data.senderUsername ?? 'Someone'}`,
      body: data.messageType === 'text' ? 'New message' : `📎 ${data.messageType}`,
      android: {
        channelId: 'messages',
        pressAction: { id: 'default' },
        groupId: data.convId as string | undefined,
      },
      data: { type: 'message', convId: data.convId as string },
    });
  } else if (data.type === 'incoming_call') {
    await notifee.displayNotification({
      title: `📞 Incoming call from @${data.callerUsername ?? 'Someone'}`,
      body: `${data.callType === 'video' ? 'Video' : 'Voice'} call`,
      android: {
        channelId: 'calls',
        pressAction: { id: 'default' },
      },
      data: { type: 'call', callId: data.callId as string },
    });
  }
});

// ─── Notifee channel setup ────────────────────────────────────────────────────
export async function setupNotifeeChannels(): Promise<void> {
  await notifee.createChannel({
    id: 'messages',
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [100, 200, 100, 200],
    sound: 'default',
  });

  await notifee.createChannel({
    id: 'calls',
    name: 'Calls',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: 'statuses',
    name: 'Status Updates',
    importance: AndroidImportance.LOW,
  });
}

// ─── Foreground messaging setup ───────────────────────────────────────────────
export async function setupMessaging(): Promise<void> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) return;

  // Foreground message handler
  messaging().onMessage(async (remoteMessage) => {
    await handleIncomingFCMMessage(remoteMessage);
  });

  // Notification-tap when app was backgrounded (not terminated)
  messaging().onNotificationOpenedApp((remoteMessage) => {
    handleNotificationTap(remoteMessage?.data);
  });

  // Notification-tap when app was terminated (cold start)
  const initialNotification = await messaging().getInitialNotification();
  if (initialNotification) {
    setTimeout(() => handleNotificationTap(initialNotification.data), 1000);
  }
}

// ─── Foreground message handler ───────────────────────────────────────────────
async function handleIncomingFCMMessage(remoteMessage: { data?: Record<string, string | object> }): Promise<void> {
  const data = remoteMessage?.data as Record<string, string> | undefined;
  if (!data) return;

  if (data.type === 'incoming_call') {
    // Update call store so the in-app overlay shows
    const call: Call = {
      id: data.callId,
      callerId: data.callerId,
      receiverIds: [],
      type: (data.callType as 'voice' | 'video') ?? 'voice',
      status: 'ringing',
      channelName: data.channelName ?? data.callId,
      createdAt: firestore.Timestamp.now(),
      callerUsername: data.callerUsername,
      callerPhotoURL: data.callerPhotoURL,
      agoraToken: '',
    };
    useCallStore.getState().setIncomingCall(call);
    return;
  }

  if (data.type === 'message') {
    await notifee.displayNotification({
      title: `@${data.senderUsername ?? 'Someone'}`,
      body: data.messageType === 'text' ? '(encrypted message)' : `📎 ${data.messageType}`,
      android: {
        channelId: 'messages',
        pressAction: { id: 'default' },
        groupId: data.convId,
      },
      ios: {
        categoryId: 'message',
      },
      data: { type: 'message', convId: data.convId },
    });
  }
}

// ─── Tap navigation helper ────────────────────────────────────────────────────
function handleNotificationTap(data: Record<string, string | object> | undefined): void {
  if (!data) return;
  const d = data as Record<string, string>;
  if (d.type === 'message' && d.convId) {
    router.push(`/(app)/chats/${d.convId}` as any);
  }
  if (d.type === 'call' && d.callId) {
    router.push(`/call/${d.callId}` as any);
  }
}

// ─── Notifee foreground event listener (returns cleanup fn) ──────────────────
export function setupNotifeeListeners(): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      handleNotificationTap(detail.notification?.data as Record<string, string> | undefined);
    }
  });
}
