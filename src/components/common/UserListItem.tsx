import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { View, Text, useThemeColor } from '../Themed';
import { Avatar } from './Avatar';
import { UserProfile } from '../../types/user';
import { formatConversationTime } from '../../utils/formatTime';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useUserStatus } from '../../hooks/useUserStatus';

interface UserListItemProps {
  user?: Partial<UserProfile>;
  title?: string;
  subtitle?: string;
  timestamp?: FirebaseFirestoreTypes.Timestamp | null;
  unreadCount?: number;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  avatarUri?: string;
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
  avatarUri,
}) => {
  const status = useUserStatus(user?.uid);
  const displayName = title ?? user?.displayName ?? user?.username ?? 'Unknown';

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar
        uri={avatarUri ?? user?.photoURL}
        name={displayName}
        size="md"
        online={status.online}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, unreadCount ? styles.nameUnread : undefined]} numberOfLines={1}>
            {displayName}
          </Text>
          {timestamp && (
            <Text type="textSecondary" style={styles.time}>{formatConversationTime(timestamp)}</Text>
          )}
        </View>
        <View style={styles.bottomRow}>
          <Text 
            type="textSecondary"
            numberOfLines={1} 
            style={[styles.subtitle, unreadCount ? styles.subtitleUnread : undefined]}
          >
            {subtitle ?? ''}
          </Text>
          {rightElement}
          {(unreadCount ?? 0) > 0 && (
            <View style={[styles.badge, { backgroundColor: useThemeColor({}, 'primary') }]}>
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
  },
  content: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '800',
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  subtitle: {
    fontSize: 14,
    flex: 1,
  },
  subtitleUnread: {
    fontWeight: '700',
  },
  badge: {
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
