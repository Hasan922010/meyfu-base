import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/shared/types/api';

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  setSession: (payload: { access: string; refresh: string; user: User }) => void;
  setAccess: (access: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      setSession: ({ access, refresh, user }) => set({ access, refresh, user }),
      setAccess: (access) => set({ access }),
      setUser: (user) => set({ user }),
      clear: () => set({ access: null, refresh: null, user: null }),
    }),
    { name: 'meyfu-auth' },
  ),
);

export const authSelectors = {
  isAuthenticated: (s: AuthState): boolean => Boolean(s.access),
};
