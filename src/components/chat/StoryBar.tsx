import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../hooks/useTheme';
import { COLORS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { useConversations } from '../../hooks/useConversations';
import { subscribeToUserStatuses } from '../../services/statusService';
import { StatusItem } from '../../types/status';
import { UserProfile } from '../../types/user';
import { router } from 'expo-router';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

interface StoryItem {
  user: UserProfile;
  items: StatusItem[];
  hasUnseen: boolean;
}

export const StoryBar: React.FC = () => {
  const { colors } = useTheme();
  const { user, userProfile } = useAuthStore();
  const conversations = useConversations();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserStatuses(user.uid, setMyStatuses);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || conversations.length === 0) return;

    // Get unique contact IDs from recent conversations
    const contactIds = Array.from(new Set(
      conversations
        .map(c => c.participants.find(p => p !== user.uid))
        .filter((id): id is string => !!id)
    )).slice(0, 10); // Limit to 10 for performance

    const unsubs: (() => void)[] = [];
    const statusMap: Record<string, { user: UserProfile; items: StatusItem[] }> = {};

    const setupListeners = async () => {
      await Promise.all(contactIds.map(async (uid) => {
        // Get user profile first
        const userDoc = await getDoc(doc(getFirestore(), 'users', uid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data() as UserProfile;

        const unsub = subscribeToUserStatuses(uid, (items) => {
          if (items.length > 0) {
            statusMap[uid] = { user: userData, items };
          } else {
            delete statusMap[uid];
          }
          
          // Convert map to sorted array (could sort by most recent status)
          const updatedStories = Object.values(statusMap).map(s => ({
            user: s.user,
            items: s.items,
            hasUnseen: true, // For now, we assume if they have items, they are "new" to simplify
          }));
          setStories(updatedStories);
        });
        unsubs.push(unsub);
      }));
    };

    setupListeners();

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [conversations.length, user]); // Only re-run when conversation count changes or user changes

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* My Story Item */}
        <View style={styles.storyItemContainer}>
          <TouchableOpacity 
            style={styles.storyCircle}
            onPress={() => myStatuses.length > 0 ? router.push(`/status/view/${user?.uid}` as any) : router.push('/status/create' as any)}
          >
            <View style={[
              styles.avatarContainer, 
              { 
                borderColor: myStatuses.length > 0 ? colors.primary : colors.border,
                borderWidth: myStatuses.length > 0 ? 2 : 1,
              }
            ]}>
              <Avatar 
                uri={userProfile?.photoURL} 
                name={userProfile?.displayName || 'You'} 
                size="md"
                shape="square"
              />
              {myStatuses.length === 0 && (
                <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.addIcon}>+</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>You</Text>
        </View>

        {/* Contacts Story Items */}
        {stories.map((item) => (
          <View key={item.user.uid} style={styles.storyItemContainer}>
            <TouchableOpacity 
              style={styles.storyCircle}
              onPress={() => router.push(`/status/view/${item.user.uid}` as any)}
            >
              <View style={[
                styles.avatarContainer, 
                { 
                  borderColor: item.hasUnseen ? colors.primary : colors.textMuted,
                  borderWidth: 2 
                }
              ]}>
                <Avatar 
                  uri={item.user.photoURL} 
                  name={item.user.displayName || 'User'} 
                  size="md"
                  shape="square"
                />
              </View>
            </TouchableOpacity>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {item.user.displayName?.split(' ')[0] || 'User'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storyItemContainer: {
    alignItems: 'center',
    width: 68,
  },
  storyCircle: {
    marginBottom: 6,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 22, // Rounded square look from screenshot
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -1,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
});
