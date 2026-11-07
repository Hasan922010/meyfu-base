import type { Role } from '@/shared/types/api';

export const ROLE_PERMISSIONS: Record<string, Role[]> = {
  '/admin': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE'],
  '/admin/products': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE'],
  '/admin/warehouse': ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE'],
  '/admin/ocr': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE'],
  '/admin/clients': ['SUPER_ADMIN', 'MANAGER'],
  '/admin/routes': ['SUPER_ADMIN', 'MANAGER'],
  '/admin/sales': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/orders': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/expenses': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/day-close': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/debts': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/finance': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/staff': ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  '/admin/distributors': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/payroll': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/reports': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/system': ['SUPER_ADMIN'],
  '/admin/refdata': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'],
  '/admin/settings': ['SUPER_ADMIN'],
  '/admin/help': ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE'],
};

export function canAccessRoute(path: string, role: Role | undefined): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  // Branch-specific exclusions are enforced by the current router/menu.
  // For shared screens a branch manager has manager permissions.
  const effectiveRole = role === 'BRANCH_MANAGER' ? 'MANAGER' : role;

  // Find the most specific (longest) route match
  let matchedRoute = '';
  for (const route of Object.keys(ROLE_PERMISSIONS)) {
    if (path === route || path.startsWith(`${route}/`)) {
      if (route.length > matchedRoute.length) {
        matchedRoute = route;
      }
    }
  }

  if (matchedRoute) {
    const allowed = ROLE_PERMISSIONS[matchedRoute];
    return Boolean(allowed?.includes(role) || allowed?.includes(effectiveRole));
  }

  return true; // Unprotected by policy dictionary
}
