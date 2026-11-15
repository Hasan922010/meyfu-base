import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { useDebounce } from '@/shared/lib/useDebounce';

import type { useProductFilters } from './useProductFilters';

interface Props {
  filters: ReturnType<typeof useProductFilters>;
}

function useDebouncedUrlFilter(
  urlValue: string,
  delay: number,
  onCommit: (value: string) => void,
): [string, (value: string) => void] {
  const [local, setLocal] = useState(urlValue);
  const debounced = useDebounce(local, delay);
  const lastCommittedRef = useRef(urlValue);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (urlValue !== lastCommittedRef.current) {
      lastCommittedRef.current = urlValue;
      setLocal(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    if (debounced !== lastCommittedRef.current) {
      lastCommittedRef.current = debounced;
      onCommitRef.current(debounced);
    }
  }, [debounced]);

  return [local, setLocal];
}

export function ProductFiltersBar({
  filters: { filters, setFilter, clearFilters },
}: Props): ReactElement {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [localSearch, setLocalSearch] = useDebouncedUrlFilter(filters.search, 300, (v) =>
    setFilter('search', v),
  );
  const [localPriceMin, setLocalPriceMin] = useDebouncedUrlFilter(
    filters.retail_price_min,
    500,
    (v) => setFilter('retail_price_min', v),
  );
  const [localPriceMax, setLocalPriceMax] = useDebouncedUrlFilter(
    filters.retail_price_max,
    500,
    (v) => setFilter('retail_price_max', v),
  );

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories({ page_size: 500 }),
  });

  const brands = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: () => catalogApi.brands({ page_size: 500 }),
  });

  const activeExtraCount = [
    filters.category,
    filters.brand,
    filters.is_active,
    filters.stock_status,
    filters.retail_price_min,
    filters.retail_price_max,
  ].filter(Boolean).length;
  const hasAnyFilter = Boolean(filters.search) || activeExtraCount > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-[200px] flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            aria-label="Mahsulot qidirish"
            className="field h-10 w-full border-slate-200 bg-slate-50 pl-9 dark:border-slate-700 dark:bg-slate-800"
            placeholder="Nomi, SKU yoki Shtrix-kod..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              onClick={() => {
                setLocalSearch('');
                if (filters.search) setFilter('search', '');
              }}
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn flex h-10 items-center gap-1.5 border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 sm:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          onClick={() => setShowMobileFilters((v) => !v)}
          aria-expanded={showMobileFilters}
          aria-controls="product-secondary-filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtrlar</span>
          {activeExtraCount > 0 && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              {activeExtraCount}
            </span>
          )}
        </button>

        {hasAnyFilter && (
          <button
            type="button"
            className="btn h-10 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            onClick={clearFilters}
          >
            Tozalash
          </button>
        )}
      </div>

      <div
        id="product-secondary-filters"
        className={`${showMobileFilters ? 'flex' : 'hidden'} flex-wrap items-center gap-3 sm:flex`}
      >

        <select
          className="field h-10 w-full border-slate-200 bg-slate-50 sm:w-40 dark:border-slate-700 dark:bg-slate-800"
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
          aria-label="Kategoriyani tanlang"
        >
          <option value="">Barcha kategoriyalar</option>
          {categories.data?.results.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="field h-10 w-full border-slate-200 bg-slate-50 sm:w-36 dark:border-slate-700 dark:bg-slate-800"
          value={filters.brand}
          onChange={(e) => setFilter('brand', e.target.value)}
          aria-label="Brendni tanlang"
        >
          <option value="">Barcha brendlar</option>
          {brands.data?.results.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          className="field h-10 w-full border-slate-200 bg-slate-50 sm:w-32 dark:border-slate-700 dark:bg-slate-800"
          value={filters.is_active}
          onChange={(e) => setFilter('is_active', e.target.value)}
          aria-label="Holatni tanlang"
        >
          <option value="">Barcha holatlar</option>
          <option value="true">Faol</option>
          <option value="false">Nofaol</option>
        </select>

        <select
          className="field h-10 w-full border-slate-200 bg-slate-50 sm:w-36 dark:border-slate-700 dark:bg-slate-800"
          value={filters.stock_status}
          onChange={(e) => setFilter('stock_status', e.target.value)}
          aria-label="Zaxira holatini tanlang"
        >
          <option value="">Barcha zaxiralar</option>
          <option value="ok">Yaxshi (Qoldiq bor)</option>
          <option value="low">Kam qoldiq</option>
          <option value="out">Tugagan</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="number"
            aria-label="Minimal narx"
            className="field h-10 w-24 border-slate-200 bg-slate-50 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800"
            placeholder="Min narx"
            value={localPriceMin}
            onChange={(e) => setLocalPriceMin(e.target.value)}
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
            aria-label="Maksimal narx"
            className="field h-10 w-24 border-slate-200 bg-slate-50 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800"
            placeholder="Max narx"
            value={localPriceMax}
            onChange={(e) => setLocalPriceMax(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

