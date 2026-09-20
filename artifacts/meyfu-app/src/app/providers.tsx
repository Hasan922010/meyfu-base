import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren, type ReactElement } from 'react';

import { queryClient } from '@/app/queryClient';
import { fetchMe } from '@/shared/api/auth';
import { ToastProvider } from '@/shared/components/Toaster';
import { useAuthStore } from '@/shared/store/authStore';
import '@/locales/i18n';

function AuthBootstrap({ children }: PropsWithChildren): ReactElement {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const access = useAuthStore((s) => s.access);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const setAuthStatus = useAuthStore((s) => s.setAuthStatus);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!access) {
      setAuthStatus('anonymous');
      return;
    }
    let active = true;
    setAuthStatus('hydrating');
    void fetchMe()
      .then((user) => {
        if (!active) return;
        setUser(user);
        setAuthStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        clear();
        setAuthStatus('anonymous');
      });
    return () => {
      active = false;
    };
  }, [access, clear, hasHydrated, setAuthStatus, setUser]);

  return children;
}

export function AppProviders({ children }: PropsWithChildren): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <ToastProvider>{children}</ToastProvider>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
