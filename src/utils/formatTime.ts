import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export function formatMessageTime(
  timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined
): string {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return format(date, 'HH:mm');
}

export function formatConversationTime(
  timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined
): string {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEE');
  return format(date, 'dd/MM/yy');
}

export function formatDateSeparator(
  timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined
): string {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function formatLastSeen(
  timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined
): string {
  if (!timestamp) return 'last seen recently';
  const date = timestamp.toDate();
  if (isToday(date)) return `last seen today at ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `last seen yesterday at ${format(date, 'HH:mm')}`;
  return `last seen ${format(date, 'dd/MM/yy')} at ${format(date, 'HH:mm')}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatExpiryCountdown(
  timestamp: FirebaseFirestoreTypes.Timestamp | null | undefined
): string {
  if (!timestamp) return 'Never expires';
  const date = timestamp.toDate();
  const now = new Date();
  if (date < now) return 'Expired';
  const diffMs = date.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffH > 24) {
    const diffD = Math.floor(diffH / 24);
    return `Expires in ${diffD}d`;
  }
  if (diffH > 0) return `Expires in ${diffH}h ${diffM}m`;
  return `Expires in ${diffM}m`;
}
