import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { PermissionDenied } from '@/shared/components/PermissionDenied';
import { canAccessRoute } from '@/shared/lib/rolePolicy';
import { useAuthStore } from '@/shared/store/authStore';
import type { Role } from '@/shared/types/api';

interface Props {
  children: ReactElement;
  roles?: readonly Role[];
}

export function ProtectedRoute({ children, roles }: Props): ReactElement {
  const location = useLocation();
  const access = useAuthStore((s) => s.access);
  const user = useAuthStore((s) => s.user);

  if (!access) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (user && !canAccessRoute(location.pathname, user.role)) {
    return <PermissionDenied />;
  }

  return children;
}
