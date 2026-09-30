import { describe, expect, it } from 'vitest';

import type { InventoryCountItem } from '@/shared/types/warehouse';

import { changedRows, differenceOf, filterRows, rebasedCountedRows, summarize } from './inventory';

function item(id: string, expected: string, actual: string | null, cost = '1000'): InventoryCountItem {
  return {
    id,
    product: `p-${id}`,
    product_name: `Tovar ${id}`,
    product_sku: `SKU-${id}`,
    product_unit: 'dona',
    expected_qty: expected,
    actual_qty: actual,
    difference: null,
    cost_price: cost,
    note: '',
  };
}

const items = [item('a', '10.000', null), item('b', '5.000', '5.000'), item('c', '0.000', null)];

describe('inventory helpers', () => {
  it('uses draft value over saved, empty draft means uncounted', () => {
    expect(differenceOf(items[0]!, { a: '7' })).toBe(-3);
    expect(differenceOf(items[1]!, { b: '' })).toBeNull();
    expect(differenceOf(items[1]!, {})).toBe(0);
  });

  it('summarizes counted rows and money difference by cost price', () => {
    const summary = summarize(items, { a: '8', c: '2' });

    expect(summary).toEqual({
      counted: 3,
      uncounted: 0,
      surplusAmount: 2000,
      shortageAmount: -2000,
    });
  });

  it('sends only rows that differ from the saved value', () => {
    const rows = changedRows(items, { a: '8', b: '5', c: '' });

    expect(rows).toEqual([{ id: 'a', actual_qty: '8' }]);
  });

  it('filters by difference, uncounted and search text', () => {
    const drafts = { a: '9' };

    expect(filterRows(items, drafts, 'diff', '').map((i) => i.id)).toEqual(['a']);
    expect(filterRows(items, drafts, 'uncounted', '').map((i) => i.id)).toEqual(['c']);
    expect(filterRows(items, drafts, 'all', 'sku-b').map((i) => i.id)).toEqual(['b']);
  });

  it('lists counted rows whose book quantity changed after refresh', () => {
    const before = [item('a', '10.000', '9.000'), item('b', '5.000', null), item('c', '1.000', '1.000')];
    const after = [item('a', '7.000', '9.000'), item('b', '2.000', null), item('c', '1.000', '1.000')];

    expect(rebasedCountedRows(before, after).map((i) => i.id)).toEqual(['a']);
  });
});

describe('dropSaved — audit FE-111', () => {
  it('saqlanganlarni olib tashlaydi, keyin kiritilganini qoldiradi', async () => {
    const { dropSaved } = await import('./inventory');
    const sent = { a: '5', b: '7' };
    const current = { a: '5', b: '8', c: '1' }; // b va c saqlash paytida o'zgardi

    expect(dropSaved(current, sent)).toEqual({ b: '8', c: '1' });
  });
});
