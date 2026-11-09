import { describe, expect, it } from 'vitest';

import { can, hasUserPermission } from './permissions';
import type { User } from '@/shared/types/api';

describe('can (audit K3b)', () => {
  it('backend ruxsatlariga mos keladi', () => {
    expect(can('ACCOUNTANT', 'cashWrite')).toBe(true);
    expect(can('MANAGER', 'cashWrite')).toBe(false);
    expect(can('ACCOUNTANT', 'ocrWrite')).toBe(false);
    expect(can('ACCOUNTANT', 'orderBuildLoading')).toBe(false);
    expect(can('MANAGER', 'payrollManage')).toBe(false);
    expect(can('ACCOUNTANT', 'payrollApprove')).toBe(false);
    expect(can('SUPER_ADMIN', 'payrollApprove')).toBe(true);
    expect(can('BRANCH_MANAGER', 'branchPriceWrite')).toBe(true);
    expect(can('SUPER_ADMIN', 'branchPriceWrite')).toBe(true);
    expect(can('ACCOUNTANT', 'branchPriceWrite')).toBe(false);
  });

  it('rol noma’lum bo‘lsa ruxsat yo‘q', () => {
    expect(can(undefined, 'cashWrite')).toBe(false);
  });
});

describe('hasUserPermission', () => {
  const baseUser: User = {
    id: 'u-1',
    phone: '+998901234567',
    full_name: 'Test Xodim',
    role: 'DISTRIBUTOR',
    avatar: null,
    is_active: true,
    last_seen_at: null,
  };

  it('SUPER_ADMIN va MANAGER uchun barcha ruxsatlar true qaytaradi', () => {
    const superAdmin: User = { ...baseUser, role: 'SUPER_ADMIN' };
    const manager: User = { ...baseUser, role: 'MANAGER' };

    expect(hasUserPermission(superAdmin, 'can_receive_stock')).toBe(true);
    expect(hasUserPermission(manager, 'can_receive_stock')).toBe(true);
    expect(hasUserPermission(manager, 'can_sell_on_debt')).toBe(true);
  });

  it('Oddiy xodim uchun permissions obyekti yoki to‘g‘ridan-to‘g‘ri flagga tayanadi', () => {
    const dist1: User = {
      ...baseUser,
      can_sell_on_debt: false,
      permissions: { can_sell_on_debt: false, can_make_sales: true },
    };
    expect(hasUserPermission(dist1, 'can_sell_on_debt')).toBe(false);
    expect(hasUserPermission(dist1, 'can_make_sales')).toBe(true);
    expect(hasUserPermission(dist1, 'can_receive_stock')).toBe(false);
  });

  it('user null yoki undefined bo‘lsa true qaytaradi (offline/test xavfsizligi)', () => {
    expect(hasUserPermission(null, 'can_make_sales')).toBe(true);
    expect(hasUserPermission(undefined, 'can_take_orders')).toBe(true);
  });
});
