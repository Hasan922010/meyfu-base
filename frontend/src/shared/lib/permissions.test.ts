import { describe, expect, it } from 'vitest';

import { can } from './permissions';

describe('can (audit K3b)', () => {
  it('backend ruxsatlariga mos keladi', () => {
    expect(can('ACCOUNTANT', 'cashWrite')).toBe(true);
    expect(can('MANAGER', 'cashWrite')).toBe(false);
    expect(can('ACCOUNTANT', 'ocrWrite')).toBe(false);
    expect(can('ACCOUNTANT', 'orderBuildLoading')).toBe(false);
    expect(can('MANAGER', 'payrollManage')).toBe(false);
    expect(can('ACCOUNTANT', 'payrollApprove')).toBe(false);
    expect(can('SUPER_ADMIN', 'payrollApprove')).toBe(true);
  });

  it('rol noma’lum bo‘lsa ruxsat yo‘q', () => {
    expect(can(undefined, 'cashWrite')).toBe(false);
  });
});
