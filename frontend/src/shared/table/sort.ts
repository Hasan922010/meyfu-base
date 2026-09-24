// Jadvallar uchun saralash va qidiruv — sof funksiyalar (brauzerda ham, server rejimida ham).

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir } | null;
export type SortValue = string | number | boolean | null | undefined;

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const collator = new Intl.Collator('uz', { sensitivity: 'base', numeric: true });

function isEmpty(v: SortValue): boolean {
  return v == null || v === '';
}

function asNumber(v: SortValue): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && NUMERIC_RE.test(v.trim())) return Number(v);
  return null;
}

/** Sonlarni son sifatida, matnni o'zbekcha alifbo bo'yicha; bo'sh qiymat doim oxirida. */
export function compareValues(a: SortValue, b: SortValue): number {
  if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b));
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na != null && nb != null) return na - nb;
  return collator.compare(String(a), String(b));
}

/** Sarlavhaga bosish: yo'q → o'sish → kamayish → yo'q; boshqa ustun — o'sishdan. */
export function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, dir: 'asc' };
  return current.dir === 'asc' ? { key, dir: 'desc' } : null;
}

/** Yangi massiv qaytaradi; bo'sh qiymatlar yo'nalishdan qat'i nazar oxirida. */
export function sortRows<T>(rows: readonly T[], value: (row: T) => SortValue, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((ra, rb) => {
    const a = value(ra);
    const b = value(rb);
    if (isEmpty(a) || isEmpty(b)) return compareValues(a, b);
    return sign * compareValues(a, b);
  });
}

export function matchesSearch<T>(
  row: T,
  fields: (row: T) => Array<string | number | null | undefined>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields(row).some((f) => f != null && String(f).toLowerCase().includes(q));
}

/** DRF OrderingFilter parametri: `field` yoki `-field`. */
export function toOrdering(sort: SortState): string | undefined {
  if (!sort) return undefined;
  return sort.dir === 'asc' ? sort.key : `-${sort.key}`;
}
