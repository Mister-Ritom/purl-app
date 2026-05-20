import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { View, Text, useThemeColor } from '../../src/components/Themed';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/store/authStore';
import { uploadAvatar, updateUserProfile } from '../../src/services/firestore';
import { COLORS, SIZES, FONTS } from '../../src/utils/constants';

export default function EditProfileScreen() {
  const { userProfile, setUserProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [about, setAbout] = useState(userProfile?.about || '');
  const [photoUri, setPhotoUri] = useState(userProfile?.photoURL || '');
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      let finalPhotoUrl = userProfile?.photoURL || '';

      if (photoUri && photoUri !== userProfile?.photoURL) {
        finalPhotoUrl = await uploadAvatar(userProfile!.uid, photoUri);
      }

      const updateData = {
        displayName: displayName.trim(),
        about: about.trim(),
        photoURL: finalPhotoUrl,
      };

      await updateUserProfile(userProfile!.uid, updateData);
      setUserProfile({ ...userProfile!, ...updateData });
      
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const background = useThemeColor({}, 'background');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color={text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} type="text">Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={isLoading} style={styles.iconBtn}>
            <Text style={[styles.saveBtn, { color: primary }, isLoading && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatar} transition={200} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: surfaceElevated }]}>
                  <Ionicons name="person" size={40} color={textSecondary} />
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: primary, borderColor: background }]}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label} type="textSecondary">Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: surface, color: text, borderColor: border }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={textSecondary}
              maxLength={30}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label} type="textSecondary">About</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: surface, color: text, borderColor: border }]}
              value={about}
              onChangeText={setAbout}
              placeholder="Available"
              placeholderTextColor={textSecondary}
              multiline
              maxLength={130}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.medium,
  },
  iconBtn: {
    padding: 4,
  },
  saveBtn: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    marginBottom: 8,
  },
  input: {
    borderRadius: SIZES.borderRadiusSm,
    padding: 12,
    fontSize: 16,
    fontFamily: FONTS.regular,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
