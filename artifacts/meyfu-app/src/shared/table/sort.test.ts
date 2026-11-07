import { describe, expect, it } from 'vitest';

import { compareValues, matchesSearch, nextSort, sortRows, toOrdering } from './sort';

describe('compareValues', () => {
  it('sonlarni son sifatida (matn emas) solishtiradi', () => {
    expect(compareValues(9, 10)).toBeLessThan(0);
    expect(compareValues('9000.00', '10000.00')).toBeLessThan(0);
  });

  it('matnni o‘zbekcha alifbo bo‘yicha, katta-kichik harfga qaramay', () => {
    expect(compareValues('baraka', 'Oila')).toBeLessThan(0);
  });

  it('bo‘sh qiymatlar doim oxirida', () => {
    expect(compareValues(null, 'a')).toBeGreaterThan(0);
    expect(compareValues('a', undefined)).toBeLessThan(0);
  });

  it('ISO sanalar xronologik', () => {
    expect(compareValues('2026-09-09', '2026-09-23')).toBeLessThan(0);
  });
});

describe('nextSort', () => {
  it('yo‘q → o‘sish → kamayish → yo‘q', () => {
    const a = nextSort(null, 'name');
    expect(a).toEqual({ key: 'name', dir: 'asc' });
    const b = nextSort(a, 'name');
    expect(b).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort(b, 'name')).toBeNull();
  });

  it('boshqa ustun bosilsa o‘sish bilan boshlanadi', () => {
    expect(nextSort({ key: 'name', dir: 'desc' }, 'total')).toEqual({ key: 'total', dir: 'asc' });
  });
});

describe('sortRows', () => {
  const rows = [
    { name: 'Oila', total: '9000.00' },
    { name: 'Baraka', total: '10000.00' },
    { name: 'Yangi', total: null },
  ];

  it('tanlangan ustun bo‘yicha saralaydi, asl massivni o‘zgartirmaydi', () => {
    const sorted = sortRows(rows, (r) => r.total, 'desc');

    expect(sorted.map((r) => r.name)).toEqual(['Baraka', 'Oila', 'Yangi']);
    expect(rows[0]?.name).toBe('Oila');
  });

  it('kamayishda ham bo‘sh qiymat oxirida qoladi', () => {
    expect(sortRows(rows, (r) => r.total, 'asc').map((r) => r.name)).toEqual([
      'Oila',
      'Baraka',
      'Yangi',
    ]);
  });
});

describe('matchesSearch', () => {
  it('bir nechta maydondan, katta-kichik harfga qaramay qidiradi', () => {
    const row = { name: "Baraka do'koni", phone: '+998901112233' };
    expect(matchesSearch(row, (r) => [r.name, r.phone], 'baraka')).toBe(true);
    expect(matchesSearch(row, (r) => [r.name, r.phone], '1112')).toBe(true);
    expect(matchesSearch(row, (r) => [r.name, r.phone], 'oila')).toBe(false);
  });

  it('bo‘sh qidiruv hammasiga mos', () => {
    expect(matchesSearch({ a: 'x' }, (r) => [r.a], '  ')).toBe(true);
  });
});

describe('toOrdering (DRF)', () => {
  it('o‘sish — maydon, kamayish — minus bilan, yo‘q — undefined', () => {
    expect(toOrdering({ key: 'total_amount', dir: 'asc' })).toBe('total_amount');
    expect(toOrdering({ key: 'total_amount', dir: 'desc' })).toBe('-total_amount');
    expect(toOrdering(null)).toBeUndefined();
  });
});
