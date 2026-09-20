import { useEffect, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useToast } from '@/shared/lib/toast';
import { useAuthStore } from '@/shared/store/authStore';
import type { Role } from '@/shared/types/api';

interface Props {
  children: ReactElement;
  roles?: readonly Role[];
}

export function ProtectedRoute({ children, roles }: Props): ReactElement {
  const location = useLocation();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const authStatus = useAuthStore((s) => s.authStatus);
  const access = useAuthStore((s) => s.access);
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const unauthorized = Boolean(roles && user && !roles.includes(user.role));

  useEffect(() => {
    if (unauthorized) {
      toast.push({
        kind: 'warning',
        title: "Bu bo'limga kirish huquqingiz yo'q",
        body: 'Rolingiz uchun mos sahifaga qaytarildingiz.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unauthorized]);

  if (!hasHydrated || authStatus === 'hydrating') {
    return <p className="p-6 text-gray-500">Yuklanmoqda…</p>;
  }

  if (!access || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (unauthorized) {
    return <Navigate to="/" replace />;
  }

  return children;
}
