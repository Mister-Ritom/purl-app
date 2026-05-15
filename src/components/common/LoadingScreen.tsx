import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { View, Text, useThemeColor } from '../Themed';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  const primary = useThemeColor({}, 'primary');
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={primary} />
      {message && <Text type="textSecondary" style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
