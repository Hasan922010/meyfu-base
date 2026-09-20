import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/shared/types/api';

interface AuthState {
  hasHydrated: boolean;
  authStatus: 'hydrating' | 'authenticated' | 'anonymous';
  access: string | null;
  refresh: string | null;
  user: User | null;
  setSession: (payload: { access: string; refresh: string; user: User }) => void;
  setTokens: (payload: { access: string; refresh: string }) => void;
  setUser: (user: User) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
  setAuthStatus: (value: AuthState['authStatus']) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      authStatus: 'hydrating',
      access: null,
      refresh: null,
      user: null,
      setSession: ({ access, refresh, user }) =>
        set({ access, refresh, user, authStatus: 'authenticated' }),
      setTokens: ({ access, refresh }) => set({ access, refresh }),
      setUser: (user) => set({ user }),
      clear: () =>
        set({ access: null, refresh: null, user: null, authStatus: 'anonymous' }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setAuthStatus: (authStatus) => set({ authStatus }),
    }),
    {
      name: 'meyfu-auth',
      partialize: ({ access, refresh, user }) => ({ access, refresh, user }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export const authSelectors = {
  isAuthenticated: (s: AuthState): boolean =>
    s.authStatus === 'authenticated' && Boolean(s.access) && Boolean(s.user),
};
