import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface OverlayToastProps {
  message: string;
  duration?: number; // ms, default 1500
}

const OverlayToast: React.FC<OverlayToastProps> = ({ message, duration = 1500 }) => {
  const [visible, setVisible] = useState(true);
  const fade = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // Auto‑fade out after duration
    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fade }] }>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 24,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
});

export default OverlayToast;
