import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/shared/store/authStore';
import type { Role } from '@/shared/types/api';
import { canAccessRoute } from '@/shared/lib/rolePolicy';
import { PermissionDenied } from '@/shared/components/PermissionDenied';

interface Props {
  children: ReactElement;
  roles?: readonly Role[];
}

export function ProtectedRoute({ children, roles }: Props): ReactElement {
  const location = useLocation();
  const access = useAuthStore((s) => s.access);
  const user = useAuthStore((s) => s.user);

  if (!access || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  // 1. Check array of explicitly passed roles
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // 2. Check centralized route policy
  if (!canAccessRoute(location.pathname, user.role)) {
    return <PermissionDenied />;
  }

  return children;
}
