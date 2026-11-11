import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './rolePolicy';

describe('rolePolicy', () => {
  it('SUPER_ADMIN can access everything', () => {
    expect(canAccessRoute('/admin', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/admin/staff', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/admin/settings', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/admin/unknown-route', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/m/receive', 'SUPER_ADMIN')).toBe(true);
  });

  it('MANAGER can access operational admin routes and staff list, not settings', () => {
    expect(canAccessRoute('/admin', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/products', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/staff', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/refdata', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/settings', 'MANAGER')).toBe(false);
  });

  it('BRANCH_MANAGER is blocked from central-only routes', () => {
    expect(canAccessRoute('/admin/staff', 'BRANCH_MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/refdata', 'BRANCH_MANAGER')).toBe(false);
    expect(canAccessRoute('/admin/system', 'BRANCH_MANAGER')).toBe(false);
    expect(canAccessRoute('/admin/settings', 'BRANCH_MANAGER')).toBe(false);
  });

  it('ACCOUNTANT can read finance/clients/staff, not settings', () => {
    expect(canAccessRoute('/admin', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/expenses', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/finance', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/clients', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/staff', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/settings', 'ACCOUNTANT')).toBe(false);
  });

  it('WAREHOUSE has limited admin access', () => {
    expect(canAccessRoute('/admin', 'WAREHOUSE')).toBe(true);
    expect(canAccessRoute('/admin/warehouse', 'WAREHOUSE')).toBe(true);
    expect(canAccessRoute('/admin/ocr', 'WAREHOUSE')).toBe(true);
    expect(canAccessRoute('/admin/sales', 'WAREHOUSE')).toBe(false);
    expect(canAccessRoute('/admin/finance', 'WAREHOUSE')).toBe(false);
    expect(canAccessRoute('/admin/audit', 'WAREHOUSE')).toBe(false);
    expect(canAccessRoute('/admin/sync-log', 'WAREHOUSE')).toBe(false);
  });

  it('DISTRIBUTOR access is primarily mobile', () => {
    expect(canAccessRoute('/m/sale', 'DISTRIBUTOR')).toBe(true);
    expect(canAccessRoute('/admin', 'DISTRIBUTOR')).toBe(false);
  });

  it('returns false for unknown role or undefined', () => {
    expect(canAccessRoute('/admin', undefined)).toBe(false);
  });

  it('handles subpaths properly by matching most specific route', () => {
    expect(canAccessRoute('/admin/products/new', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/settings/advanced', 'MANAGER')).toBe(false);
  });
});

