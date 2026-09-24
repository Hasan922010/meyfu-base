import { useMemo, useState } from 'react';

import { matchesSearch, nextSort, sortRows, type SortState, type SortValue } from './sort';

export interface ClientTableOptions<T> {
  rows: readonly T[] | undefined;
  /** Saralanadigan ustunlar: kalit → qiymat */
  sortBy: Record<string, (row: T) => SortValue>;
  /** Qidiruv qaysi maydonlarda */
  searchIn?: (row: T) => Array<string | number | null | undefined>;
  /** Filtrlar: kalit → (qator, tanlangan qiymat) => mosmi. Bo'sh qiymat — filtr o'chiq. */
  filters?: Record<string, (row: T, value: string) => boolean>;
  initialSort?: SortState;
}

export interface ClientTable<T> {
  rows: T[];
  sort: SortState;
  onSort: (key: string) => void;
  search: string;
  setSearch: (q: string) => void;
  filterValues: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  reset: () => void;
}

/** Bir marta yuklangan ro'yxatlar uchun: brauzerda saralash, qidiruv va filtr. */
export function useClientTable<T>({
  rows,
  sortBy,
  searchIn,
  filters,
  initialSort = null,
}: ClientTableOptions<T>): ClientTable<T> {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [search, setSearch] = useState<string>('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    const matched = (rows ?? []).filter(
      (r) =>
        (!searchIn || matchesSearch(r, searchIn, search)) &&
        Object.entries(filterValues).every(
          ([key, value]) => !value || (filters?.[key]?.(r, value) ?? true),
        ),
    );
    const getValue = sort ? sortBy[sort.key] : undefined;
    return sort && getValue ? sortRows(matched, getValue, sort.dir) : matched;
  }, [rows, search, searchIn, filterValues, filters, sort, sortBy]);

  return {
    rows: visible,
    sort,
    onSort: (key) => setSort((s) => nextSort(s, key)),
    search,
    setSearch,
    filterValues,
    setFilter: (key, value) => setFilterValues((f) => ({ ...f, [key]: value })),
    reset: () => {
      setSearch('');
      setFilterValues({});
      setSort(initialSort);
    },
  };
}
