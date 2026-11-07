import { describe, expect, it } from 'vitest';

import { toPoint } from './mapPoints';

describe('toPoint — koordinatani xarita nuqtasiga', () => {
  it('satr koordinatalarni raqamga o‘giradi', () => {
    expect(toPoint('1', '41.311100', '69.279700', 'Do‘kon')).toEqual({
      id: '1', lat: 41.3111, lng: 69.2797, label: 'Do‘kon',
    });
  });

  it('bo‘sh yoki yaroqsiz koordinata — null (0,0 ga tushmaydi)', () => {
    expect(toPoint('1', null, '69.2', 'x')).toBeNull();
    expect(toPoint('1', '', '', 'x')).toBeNull();
    expect(toPoint('1', 'abc', '69.2', 'x')).toBeNull();
  });

  it('rang berilsa qo‘shadi', () => {
    expect(toPoint('1', 1, 2, 'x', '#f00')?.color).toBe('#f00');
  });
});
