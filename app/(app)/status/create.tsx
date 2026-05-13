import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS } from '../../../src/utils/constants';
import { useAuthStore } from '../../../src/store/authStore';
import { getFirestore, collection, doc, addDoc, serverTimestamp } from '@react-native-firebase/firestore';

export default function CreateStatusScreen() {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.postBtn, !text.trim() && styles.postBtnDisabled]} 
          onPress={handlePost}
          disabled={!text.trim() || loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postText}>Post</Text>}
        </TouchableOpacity>
      </View>
      
      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        placeholderTextColor={COLORS.textMuted}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  cancel: { color: COLORS.text, fontSize: 16 },
  postBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnDisabled: { opacity: 0.5 },
  postText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  input: { flex: 1, color: COLORS.text, fontSize: 20, padding: 20, textAlignVertical: 'top' },
});
