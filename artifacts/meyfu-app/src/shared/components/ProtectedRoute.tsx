import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

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

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
