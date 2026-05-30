import React from 'react';
import {
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { View, Text, useThemeColor } from '../Themed';
import { Avatar } from './Avatar';
import { UserProfile } from '../../types/user';
import { formatConversationTime } from '../../utils/formatTime';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useUserStatus } from '../../hooks/useUserStatus';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const badgeBgColor = useThemeColor({}, 'primary');
  const displayName = title ?? user?.displayName ?? user?.username ?? 'Unknown';

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <AnimatedPressable
      style={[styles.container, style, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
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
            type={unreadCount ? "text" : "textSecondary"}
            numberOfLines={2} 
            style={[styles.subtitle, unreadCount ? styles.subtitleUnread : undefined]}
          >
            {subtitle ?? ''}
          </Text>
          {rightElement}
          {(unreadCount ?? 0) > 0 && (
            <View style={[styles.badge, { backgroundColor: badgeBgColor }]}>
              <Text style={styles.badgeText}>
                {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontFamily: 'Inter_700Bold',
  },
  time: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    flex: 1,
    lineHeight: 20,
  },
  subtitleUnread: {
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
});
