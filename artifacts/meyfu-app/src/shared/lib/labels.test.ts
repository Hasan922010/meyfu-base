import { describe, expect, it } from 'vitest';

import { paymentLabel, roleLabel } from './labels';

describe('labels (audit m5)', () => {
  it('rol kodini o‘zbekcha nomga aylantiradi', () => {
    expect(roleLabel('ACCOUNTANT')).toBe('Buxgalter');
    expect(roleLabel('SUPER_ADMIN')).toBe('Super admin');
    expect(roleLabel(undefined)).toBe('—');
  });

  it('to‘lov turini o‘zbekcha nomga aylantiradi, noma’lumini o‘zgartirmaydi', () => {
    expect(paymentLabel('OTKAZMA')).toBe("O'tkazma");
    expect(paymentLabel('NAQD')).toBe('Naqd');
    expect(paymentLabel('X')).toBe('X');
  });
});
