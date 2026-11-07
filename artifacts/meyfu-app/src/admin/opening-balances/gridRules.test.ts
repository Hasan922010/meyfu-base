import { describe, expect, it } from 'vitest';

import type { OpeningSheetRow } from '@/shared/api/opening';

import { changedTargets, hasIssues, rowIssue, searchRows } from './gridRules';

const signed = { allowNegative: true, increaseOnly: false };
const debt = { allowNegative: false, increaseOnly: true };

const rows: OpeningSheetRow[] = [
  { id: 'a', name: 'Ali do‘kon', code: '+998901', current: '100000.00' },
  { id: 'b', name: 'Vali savdo', code: '+998902', current: '0.00' },
];

describe('gridRules', () => {
  it('flags invalid, negative and lowering values without blame', () => {
    expect(rowIssue('0', 'abc', signed)).toBe('Raqam kiriting');
    expect(rowIssue('0', '-5', debt)).toBe("Manfiy bo'lmaydi");
    expect(rowIssue('100', '40', debt)).toBe("Kamaytirish — qarz to'lovi orqali");
    expect(rowIssue('100', '-40', signed)).toBeNull();
    expect(rowIssue('100', '', debt)).toBeNull();
  });

  it('sends only rows whose target differs from current', () => {
    const drafts = { a: '100000', b: '25000' };

    expect(changedTargets(rows, drafts, signed)).toEqual([{ id: 'b', target: '25000' }]);
  });

  it('blocks saving while a row has an issue', () => {
    expect(hasIssues(rows, { a: '50000' }, debt)).toBe(true);
    expect(hasIssues(rows, { a: '150000' }, debt)).toBe(false);
  });

  it('searches by name and code', () => {
    expect(searchRows(rows, 'vali').map((r) => r.id)).toEqual(['b']);
    expect(searchRows(rows, '901').map((r) => r.id)).toEqual(['a']);
  });
});
