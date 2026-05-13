import { Linking } from 'react-native';
import { router } from 'expo-router';

export function setupDeepLinkHandler(): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  // Handle cold start
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });

  return () => subscription.remove();
}

function handleDeepLink(url: string): void {
  if (!url) return;
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(':', '');
    if (scheme !== 'purl' && !url.includes('purl')) return;

    // purl://invite?token=XXXX-XXXX-XXXX
    if (parsed.pathname.includes('invite') || parsed.hostname === 'invite') {
      const token = parsed.searchParams.get('token');
      if (token) {
        router.push({ pathname: '/invite/scan', params: { token } });
      }
      return;
    }

    // purl://chat?convId=xxx
    if (parsed.pathname.includes('chat') || parsed.hostname === 'chat') {
      const convId = parsed.searchParams.get('convId');
      if (convId) {
        router.push(`/chats/${convId}`);
      }
      return;
    }

    // purl://profile?uid=xxx
    if (parsed.pathname.includes('profile') || parsed.hostname === 'profile') {
      const uid = parsed.searchParams.get('uid');
      if (uid) {
        router.push(`/profile/${uid}`);
      }
      return;
    }

    // purl://call?callId=xxx
    if (parsed.pathname.includes('call') || parsed.hostname === 'call') {
      const callId = parsed.searchParams.get('callId');
      if (callId) {
        router.push(`/call/${callId}`);
      }
      return;
    }
  } catch (e) {
    console.warn('Failed to parse deep link:', url, e);
  }
}

export function buildInviteLink(token: string): string {
  return `purl://invite?token=${token}`;
}

export function buildProfileLink(uid: string): string {
  return `purl://profile?uid=${uid}`;
}
