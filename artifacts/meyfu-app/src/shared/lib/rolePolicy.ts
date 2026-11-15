import type { Role } from '@/shared/types/api';

const NON_WAREHOUSE_ADMIN: Role[] = ['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'ACCOUNTANT'];
const ALL_ADMIN_LAYOUT: Role[] = [...NON_WAREHOUSE_ADMIN, 'WAREHOUSE'];
const CENTRAL_ADMIN_ONLY: Role[] = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];

export const ROLE_PERMISSIONS: Record<string, Role[]> = {
  '/admin': ALL_ADMIN_LAYOUT,
  '/admin/products': ALL_ADMIN_LAYOUT,
  '/admin/warehouse': ALL_ADMIN_LAYOUT,
  '/admin/branches': ALL_ADMIN_LAYOUT,
  '/admin/opening-balances': ALL_ADMIN_LAYOUT,
  '/admin/ocr': ALL_ADMIN_LAYOUT,
  '/admin/clients': NON_WAREHOUSE_ADMIN,
  '/admin/routes': NON_WAREHOUSE_ADMIN,
  '/admin/sales': NON_WAREHOUSE_ADMIN,
  '/admin/orders': NON_WAREHOUSE_ADMIN,
  '/admin/expenses': NON_WAREHOUSE_ADMIN,
  '/admin/day-close': NON_WAREHOUSE_ADMIN,
  '/admin/debts': NON_WAREHOUSE_ADMIN,
  '/admin/finance': NON_WAREHOUSE_ADMIN,
  '/admin/staff': NON_WAREHOUSE_ADMIN,
  '/admin/distributors': NON_WAREHOUSE_ADMIN,
  '/admin/payroll': NON_WAREHOUSE_ADMIN,
  '/admin/reports': NON_WAREHOUSE_ADMIN,
  '/admin/sync-log': NON_WAREHOUSE_ADMIN,
  '/admin/audit': NON_WAREHOUSE_ADMIN,
  '/admin/refdata': CENTRAL_ADMIN_ONLY,
  '/admin/system': CENTRAL_ADMIN_ONLY,
  '/admin/settings': ['SUPER_ADMIN'],
  '/admin/help': ALL_ADMIN_LAYOUT,
};

export function canAccessRoute(path: string, role: Role | undefined): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;

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
    return Boolean(allowed?.includes(role));
  }

  return true;
}

