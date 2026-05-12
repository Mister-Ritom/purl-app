import { create } from 'zustand';

interface SettingsStore {
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  setTheme: (t: 'dark' | 'light' | 'system') => void;
  setFontSize: (s: 'small' | 'medium' | 'large') => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  theme: 'dark',
  fontSize: 'medium',
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize }),
}));
