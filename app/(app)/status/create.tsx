import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '../../../src/components/Themed';
import { useTheme } from '../../../src/hooks/useTheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/store/authStore';
import { getFirestore, collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore';

export default function CreateStatusScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || !user) return;
    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(getFirestore(), 'statuses', user.uid, 'items'), {
        type: 'text',
        content: text.trim(),
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
      });

      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to post status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.postBtn, { backgroundColor: colors.primary }, !text.trim() && styles.postBtnDisabled]} 
          onPress={handlePost}
          disabled={!text.trim() || loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postText}>Post</Text>}
        </TouchableOpacity>
      </View>
      
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder="What's on your mind?"
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        maxLength={280}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  postBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnDisabled: { opacity: 0.5 },
  postText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  input: { flex: 1, fontSize: 20, padding: 20, textAlignVertical: 'top' },
});
