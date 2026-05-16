import React from 'react';
import {
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { View, Text, useThemeColor } from '../Themed';
import { SIZES } from '../../utils/constants';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  online?: boolean;
  style?: ViewStyle;
}

const SIZE_MAP = {
  sm: SIZES.avatarSm,
  md: SIZES.avatarMd,
  lg: SIZES.avatarLg,
  xl: SIZES.avatarXl,
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorForName(name?: string): string {
  const palette = ['#6C63FF', '#FF6B9D', '#FFA726', '#26C6DA', '#66BB6A', '#EF5350', '#AB47BC'];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'md',
  shape = 'circle',
  online,
  style,
}) => {
  const dim = SIZE_MAP[size];
  const fontSize = dim * 0.36;
  const onlineDotSize = dim * 0.28;
  const dotColor = useThemeColor({}, online ? 'online' : 'textMuted');
  const borderColor = useThemeColor({}, 'background');
  const borderRadius = shape === 'circle' ? dim / 2 : dim / 3;

  return (
    <View style={[styles.container, { width: dim, height: dim }, style]}>
      {uri ? (
        <Image
          source={uri}
          style={[styles.image, { width: dim, height: dim, borderRadius }]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: dim,
              height: dim,
              borderRadius,
              backgroundColor: getColorForName(name),
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.onlineDot,
            {
              width: onlineDotSize,
              height: onlineDotSize,
              borderRadius: onlineDotSize / 2,
              backgroundColor: dotColor,
              borderColor: borderColor,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    borderWidth: 2,
  },
});
