import { create } from 'zustand';
import { StatusItem } from '../types/status';

interface StatusStore {
  myStatuses: StatusItem[];
  contactStatuses: Record<string, StatusItem[]>;
  setMyStatuses: (items: StatusItem[]) => void;
  setContactStatuses: (uid: string, items: StatusItem[]) => void;
}

export const useStatusStore = create<StatusStore>((set) => ({
  myStatuses: [],
  contactStatuses: {},
  setMyStatuses: (items) => set({ myStatuses: items }),
  setContactStatuses: (uid, items) =>
    set((s) => ({ contactStatuses: { ...s.contactStatuses, [uid]: items } })),
}));
