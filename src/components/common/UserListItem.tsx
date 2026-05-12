import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Avatar } from './Avatar';
import { COLORS } from '../../utils/constants';
import { UserProfile } from '../../types/user';
import { formatConversationTime } from '../../utils/formatTime';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

interface UserListItemProps {
  user?: Partial<UserProfile>;
  title?: string;
  subtitle?: string;
  timestamp?: FirebaseFirestoreTypes.Timestamp | null;
  unreadCount?: number;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  isOnline?: boolean;
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  title,
  subtitle,
  timestamp,
  unreadCount,
  rightElement,
  onPress,
  style,
  isOnline,
}) => {
  const displayName = title ?? user?.displayName ?? user?.username ?? 'Unknown';

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar
        uri={user?.photoURL}
        name={displayName}
        size="md"
        online={isOnline}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {timestamp && (
            <Text style={styles.time}>{formatConversationTime(timestamp)}</Text>
          )}
        </View>
        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={[styles.subtitle, unreadCount ? styles.subtitleUnread : undefined]}>
            {subtitle ?? ''}
          </Text>
          {rightElement}
          {(unreadCount ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  subtitleUnread: {
    color: COLORS.text,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
