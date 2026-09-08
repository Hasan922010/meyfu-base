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
  const access = useAuthStore((s) => s.access);
  const user = useAuthStore((s) => s.user);

  if (!access) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
