import { 
  getMessaging, 
  setBackgroundMessageHandler, 
  requestPermission, 
  hasPermission,
  onMessage, 
  onNotificationOpenedApp, 
  getInitialNotification, 
  getAPNSToken,
  getToken,
  onTokenRefresh,
  AuthorizationStatus,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { getFirestore, doc, updateDoc, Timestamp } from '@react-native-firebase/firestore';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useCallStore } from '../store/callStore';
import { Call } from '../types/call';

// ─── Background handler — MUST be registered at module level ─────────────────
// This file is imported by index.ts at the top level (before any React render),
// so this call happens before any navigator is mounted.
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
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
  // Foreground message handler
  onMessage(getMessaging(), async (remoteMessage) => {
    await handleIncomingFCMMessage(remoteMessage);
  });

  // Notification-tap when app was backgrounded (not terminated)
  onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
    handleNotificationTap(remoteMessage?.data);
  });

  // Notification-tap when app was terminated (cold start)
  const initialNotification = await getInitialNotification(getMessaging());
  if (initialNotification) {
    setTimeout(() => handleNotificationTap(initialNotification.data), 1000);
  }
}

// ─── Notification Permission Helpers ──────────────────────────────────────────
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await hasPermission(getMessaging()) as any;
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL ||
      authStatus === 1 ||
      authStatus === 2 ||
      authStatus === true
    );
  } catch (error) {
    console.error('[Messaging] Failed to check notification permission:', error);
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      await registerDeviceForRemoteMessages(getMessaging());
    }
    const authStatus = await requestPermission(getMessaging()) as any;
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL ||
      authStatus === 1 ||
      authStatus === 2 ||
      authStatus === true;

    return enabled;
  } catch (error) {
    console.error('[Messaging] Failed to request notification permission:', error);
    return false;
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
      createdAt: Timestamp.now(),
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
    router.push(`/chats/${d.convId}` as any);
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

// ─── Token Registration ───────────────────────────────────────────────────────
export async function registerFcmToken(uid: string): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      try {
        const apnsToken = await getAPNSToken(getMessaging());
        if (!apnsToken) {
          console.warn('[Messaging] No APNS token yet. FCM registration will retry when token is available.');
          return;
        }
      } catch (apnsError: any) {
        console.warn(
          '[Messaging] APNS token retrieval failed (expected on simulators or unpaid developer accounts):',
          apnsError.message || apnsError
        );
        return;
      }
    }

    const token = await getToken(getMessaging());
    if (token) {
      await saveTokenToFirestore(uid, token);
    }

    onTokenRefresh(getMessaging(), async (newToken) => {
      await saveTokenToFirestore(uid, newToken);
    });
  } catch (error: any) {
    if (error.message?.includes('No APNS token')) {
      console.warn('[Messaging] FCM Token registration deferred: No APNS token (common on simulators).');
    } else {
      console.error('[Messaging] Failed to register FCM token:', error);
    }
  }
}

async function saveTokenToFirestore(uid: string, token: string): Promise<void> {
  try {
    const db = getFirestore();
    await updateDoc(doc(db, 'users', uid), {
      fcmToken: token,
      lastTokenUpdate: Timestamp.now(),
    });
    console.log('[Messaging] FCM Token saved for user:', uid);
  } catch (error) {
    console.error('[Messaging] Failed to save FCM token to Firestore:', error);
  }
}
