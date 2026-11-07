import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './rolePolicy';

describe('rolePolicy', () => {
  it('SUPER_ADMIN can access everything', () => {
    expect(canAccessRoute('/admin', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/admin/staff', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/admin/unknown-route', 'SUPER_ADMIN')).toBe(true);
    expect(canAccessRoute('/m/receive', 'SUPER_ADMIN')).toBe(true);
  });

  it('MANAGER can access specific admin routes but not all', () => {
    expect(canAccessRoute('/admin', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/products', 'MANAGER')).toBe(true);
    // Should not be able to access staff or settings
    expect(canAccessRoute('/admin/staff', 'MANAGER')).toBe(false);
    expect(canAccessRoute('/admin/settings', 'MANAGER')).toBe(false);
  });

  it('ACCOUNTANT has finance-oriented access', () => {
    expect(canAccessRoute('/admin', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/expenses', 'ACCOUNTANT')).toBe(true);
    expect(canAccessRoute('/admin/finance', 'ACCOUNTANT')).toBe(true);
    // Should not access products or staff
    expect(canAccessRoute('/admin/staff', 'ACCOUNTANT')).toBe(false);
    expect(canAccessRoute('/admin/clients', 'ACCOUNTANT')).toBe(false);
  });

  it('WAREHOUSE has limited admin access', () => {
    expect(canAccessRoute('/admin', 'WAREHOUSE')).toBe(true);
    expect(canAccessRoute('/admin/warehouse', 'WAREHOUSE')).toBe(true);
    expect(canAccessRoute('/admin/ocr', 'WAREHOUSE')).toBe(true);
    // No access to sales, finance
    expect(canAccessRoute('/admin/sales', 'WAREHOUSE')).toBe(false);
    expect(canAccessRoute('/admin/finance', 'WAREHOUSE')).toBe(false);
  });

  it('DISTRIBUTOR access is primarily mobile', () => {
    // Usually mobile routes start with /m and are allowed by policy wrapper 
    // (exact restrictions happen in mobile layout config)
    expect(canAccessRoute('/m/sale', 'DISTRIBUTOR')).toBe(true);
    // Admin layout usually restricted
    expect(canAccessRoute('/admin', 'DISTRIBUTOR')).toBe(false);
  });

  it('returns false for unknown role or undefined', () => {
    expect(canAccessRoute('/admin', undefined)).toBe(false);
  });

  it('handles subpaths properly by matching most specific route', () => {
    // Let's pretend /admin/products is allowed for MANAGER, 
    // but /admin/products/special isn't defined explicitly, it inherits from /admin/products
    expect(canAccessRoute('/admin/products/new', 'MANAGER')).toBe(true);
    expect(canAccessRoute('/admin/settings/advanced', 'MANAGER')).toBe(false);
  });
});
