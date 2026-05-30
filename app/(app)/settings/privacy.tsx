import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from "react-native-vector-icons/dist/Ionicons";
import { COLORS, FONTS } from '../../../src/utils/constants';

export default function PrivacySettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholderText}>Privacy settings coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.bold },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: COLORS.textSecondary, fontSize: 16, fontFamily: FONTS.regular },
});
