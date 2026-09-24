import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/shared/types/api';

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  setSession: (payload: { access: string; refresh: string; user: User }) => void;
  /** Refresh javobi: backend ROTATE_REFRESH_TOKENS bilan yangi refresh ham qaytaradi. */
  setAccess: (access: string, refresh?: string) => void;
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
      setAccess: (access, refresh) => set(refresh ? { access, refresh } : { access }),
      setUser: (user) => set({ user }),
      clear: () => set({ access: null, refresh: null, user: null }),
    }),
    { name: 'meyfu-auth' },
  ),
);

// Boshqa tab tokenni almashtirsa (rotatsiya) yoki chiqsa — bu tab ham darhol biladi.
// Aks holda bu tab eski, qora ro'yxatdagi refresh bilan urinib, hammani chiqarib yuborardi.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'meyfu-auth') void useAuthStore.persist.rehydrate();
  });
}

export const authSelectors = {
  isAuthenticated: (s: AuthState): boolean => Boolean(s.access),
};
