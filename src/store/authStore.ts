import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { UserProfile } from '../types/user';
import { KeyPair } from '../services/encryption';

interface AuthStore {
  user: FirebaseAuthTypes.User | null;
  userProfile: UserProfile | null;
  keyPair: KeyPair | null;
  isLoading: boolean;
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setKeyPair: (kp: KeyPair | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  userProfile: null,
  keyPair: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setKeyPair: (kp) => set({ keyPair: kp }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
