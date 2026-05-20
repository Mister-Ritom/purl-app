import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useAuthStore } from '../../src/store/authStore';
import { useChatStore } from '../../src/store/chatStore';
import { useConversations } from '../../src/hooks/useConversations';
import { Avatar } from '../../src/components/common/Avatar';
import { createConversation, fetchUserProfile } from '../../src/services/firestore';
import { generateGroupKey, encryptGroupKey } from '../../src/services/encryption';
import { useTheme } from '../../src/hooks/useTheme';
import { UserProfile } from '../../src/types/user';
import { COLORS, FONTS } from '../../src/utils/constants';

export default function CreateGroupScreen() {
  const { colors } = useTheme();
  const { user, userProfile, keyPair } = useAuthStore();
  const conversations = useConversations();
  
  const [groupName, setGroupName] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  useEffect(() => {
    async function loadContacts() {
      if (!user) return;
      try {
        const uids = new Set<string>();
        conversations.forEach(c => {
          if (!c.isGroup) {
            c.participants.forEach(p => {
              if (p !== user.uid) uids.add(p);
            });
          }
        });

        const profiles = await Promise.all(
          Array.from(uids).map(uid => fetchUserProfile(uid))
        );
        setContacts(profiles.filter((p): p is UserProfile => p !== null));
      } catch (err) {
        console.error('Error loading contacts:', err);
      } finally {
        setIsLoadingContacts(false);
      }
    }
    loadContacts();
  }, [conversations, user]);

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
    if (!user || !userProfile || !keyPair) return;

    setIsCreating(true);
    try {
      const allParticipants = [user.uid, ...selectedUids];
      const groupKey = generateGroupKey();
      
      const encryptedGroupKeys: Record<string, any> = {};
      
      // Encrypt for self
      if (userProfile.publicKey) {
        encryptedGroupKeys[user.uid] = encryptGroupKey(
          groupKey, 
          userProfile.publicKey, 
          keyPair.privateKey
        );
      }

      // Encrypt for others
      for (const uid of selectedUids) {
        const contact = contacts.find(c => c.uid === uid);
        if (contact?.publicKey) {
          encryptedGroupKeys[uid] = encryptGroupKey(
            groupKey,
            contact.publicKey,
            keyPair.privateKey
          );
        }
      }

      const convId = await createConversation(allParticipants, true, {
        groupName: groupName.trim(),
        admins: [user.uid],
        encryptedGroupKeys
      });

      // Cache the key locally
      useChatStore.getState().cacheGroupKey(convId, groupKey);

      router.replace(`/chats/${convId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
          <TouchableOpacity 
            style={[styles.createBtn, (isCreating || !groupName || selectedUids.length === 0) && { opacity: 0.5 }]}
            onPress={handleCreateGroup}
            disabled={isCreating || !groupName || selectedUids.length === 0}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.createBtnText, { color: colors.primary }]}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="camera" size={24} color={colors.textMuted} />
          </View>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Group Subject"
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={25}
          />
        </View>

        <View style={[styles.selectionHeader, { backgroundColor: colors.surface }]}>
          <Text style={[styles.selectionTitle, { color: colors.textSecondary }]}>Add Members</Text>
          <Text style={[styles.selectionCount, { color: colors.primary }]}>{selectedUids.length} selected</Text>
        </View>

        {isLoadingContacts ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={item => item.uid}
            renderItem={({ item }) => {
              const isSelected = selectedUids.includes(item.uid);
              return (
                <TouchableOpacity 
                  style={[styles.userRow, { borderBottomColor: colors.border }]} 
                  onPress={() => toggleSelect(item.uid)}
                >
                  <Avatar uri={item.photoURL} name={item.displayName} size="md" />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.displayName}</Text>
                    <Text style={[styles.userUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
                  </View>
                  <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No contacts found. Start a chat with someone to add them to a group.</Text>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  createBtn: { padding: 4, minWidth: 60, alignItems: 'flex-end' },
  createBtnText: { fontSize: 16, fontWeight: '700' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectionTitle: { fontSize: 14, fontWeight: '600' },
  selectionCount: { fontSize: 14, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '600' },
  userUsername: { fontSize: 14, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { textAlign: 'center', marginTop: 40, paddingHorizontal: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
