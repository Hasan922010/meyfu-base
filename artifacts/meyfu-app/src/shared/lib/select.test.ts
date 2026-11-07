import { describe, expect, it } from 'vitest';

import { withOnlyOption } from './select';

describe('withOnlyOption', () => {
  it('tanlangan qiymatni saqlaydi', () => {
    expect(withOnlyOption('b', [{ id: 'a' }])).toBe('b');
  });

  it('yagona variantni tanlaydi, bir nechta yoki yo‘q bo‘lsa bo‘sh', () => {
    expect(withOnlyOption('', [{ id: 'a' }])).toBe('a');
    expect(withOnlyOption('', [{ id: 'a' }, { id: 'b' }])).toBe('');
    expect(withOnlyOption('', undefined)).toBe('');
  });
});
