import React, { useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { View, Text } from '../../src/components/Themed';
import { useTheme } from '../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithGoogle } from '../../src/services/auth';

export default function WelcomeScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Sign-in failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#0A0A0F', '#12104A', '#0A0A0F'] : ['#F8FAFC', '#EEF2FF', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={{ flex: 1 }}>

      {/* Hero Section */}
      <View style={styles.hero}>
        <Image source={require('../../icon.png')} style={styles.logo} />
        <Text style={styles.appName}>Purl</Text>
        <Text style={styles.tagline}>Fully encrypted. Beautifully simple.</Text>
        <Text style={styles.description}>
          Connect with anyone on your terms.{'\n'}End-to-end encrypted by design.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: '🔐', text: 'End-to-end encrypted messages' },
          { icon: '🔑', text: 'Invite-only connections' },
          { icon: '📞', text: 'Encrypted voice & video calls' },
        ].map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 22,
    marginBottom: 20,
  },
  appName: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: 16,
    paddingVertical: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  featureIcon: {
    fontSize: 22,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    gap: 16,
    marginTop: 'auto',
    paddingBottom: 20,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  legal: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});
