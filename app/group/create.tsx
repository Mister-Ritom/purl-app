import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useConversations } from '../../src/hooks/useConversations';
import { Avatar } from '../../src/components/common/Avatar';
import { createConversation } from '../../src/services/firestore';
import { generateGroupKey, encryptGroupKey } from '../../src/services/encryption';
import { COLORS, FONTS, SIZES } from '../../src/utils/constants';

export default function CreateGroupScreen() {
  const { userProfile, keyPair } = useAuthStore();
  const { users } = useConversations(); // Assuming we have access to searchable users here
  
  const [groupName, setGroupName] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // In a real app we'd fetch actual friends/contacts. Using mocked users for now
  const availableUsers = Object.values(users).filter(u => u.id !== userProfile?.uid);

  const toggleSelect = (uid: string) => {
    if (selectedUids.includes(uid)) {
      setSelectedUids(selectedUids.filter(id => id !== uid));
    } else {
      setSelectedUids([...selectedUids, uid]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    if (selectedUids.length === 0) {
      Alert.alert('Error', 'Select at least one member');
      return;
    }
    if (!userProfile || !keyPair) return;

    setIsCreating(true);
    try {
      const allParticipants = [userProfile.uid, ...selectedUids];
      const groupKey = generateGroupKey();
      
      const encryptedGroupKeys: Record<string, any> = {};
      
      // Encrypt for self
      encryptedGroupKeys[userProfile.uid] = encryptGroupKey(
        groupKey, 
        userProfile.publicKey, 
        keyPair.privateKey
      );

      // Encrypt for others
      for (const uid of selectedUids) {
        const u = users[uid];
        if (u?.publicKey) {
          encryptedGroupKeys[uid] = encryptGroupKey(
            groupKey,
            u.publicKey,
            keyPair.privateKey
          );
        }
      }

      const convId = await createConversation(allParticipants, true, {
        groupName: groupName.trim(),
        admins: [userProfile.uid],
        encryptedGroupKeys
      });

      router.replace(`/(app)/chats/${convId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity 
            style={[styles.createBtn, (isCreating || !groupName || selectedUids.length === 0) && { opacity: 0.5 }]}
            onPress={handleCreateGroup}
            disabled={isCreating || !groupName || selectedUids.length === 0}
          >
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="camera" size={24} color={COLORS.textMuted} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Group Subject"
            placeholderTextColor={COLORS.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={25}
          />
        </View>

        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>Add Members</Text>
          <Text style={styles.selectionCount}>{selectedUids.length} selected</Text>
        </View>

        <FlatList
          data={availableUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedUids.includes(item.id);
            return (
              <TouchableOpacity style={styles.userRow} onPress={() => toggleSelect(item.id)}>
                <Avatar url={item.photoURL} name={item.displayName} size={48} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName}</Text>
                  <Text style={styles.userUsername}>@{item.username}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.background} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No contacts found</Text>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: FONTS.medium,
  },
  createBtn: {
    padding: 4,
  },
  createBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.regular,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  selectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  selectionCount: {
    color: COLORS.primary,
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  userUsername: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontFamily: FONTS.regular,
  },
});
