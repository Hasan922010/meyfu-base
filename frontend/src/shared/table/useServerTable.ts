import { useEffect, useMemo, useState } from 'react';

import { nextSort, toOrdering, type SortState } from './sort';

const SEARCH_DEBOUNCE_MS = 300;

export type ServerTableParams = {
  ordering?: string;
  search?: string;
  page: number;
} & Record<string, string | number | undefined>;

export interface ServerTable {
  params: ServerTableParams;
  sort: SortState;
  onSort: (key: string) => void;
  search: string;
  setSearch: (q: string) => void;
  filterValues: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  page: number;
  setPage: (page: number) => void;
  reset: () => void;
}

/**
 * Server sahifalaydigan jadvallar uchun: saralash/qidiruv/filtr DRF parametrlariga
 * aylanadi (`ordering`, `search`, filtr maydonlari), shunda barcha yozuvlar ustida
 * ishlaydi — faqat ko'rinib turgan sahifada emas. O'zgarganda sahifa 1 ga qaytadi.
 */
export function useServerTable({ initialSort = null }: { initialSort?: SortState } = {}): ServerTable {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [search, setSearchRaw] = useState<string>('');
  const [debounced, setDebounced] = useState<string>('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const params = useMemo<ServerTableParams>(() => {
    const active = Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v !== ''));
    const ordering = toOrdering(sort);
    return {
      ...(ordering ? { ordering } : {}),
      ...(debounced ? { search: debounced } : {}),
      ...active,
      page,
    };
  }, [sort, debounced, filterValues, page]);

  return {
    params,
    sort,
    onSort: (key) => {
      setSort((s) => nextSort(s, key));
      setPage(1);
    },
    search,
    setSearch: setSearchRaw,
    filterValues,
    setFilter: (key, value) => {
      setFilterValues((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
    page,
    setPage,
    reset: () => {
      setSort(initialSort);
      setSearchRaw('');
      setDebounced('');
      setFilterValues({});
      setPage(1);
    },
  };
}
