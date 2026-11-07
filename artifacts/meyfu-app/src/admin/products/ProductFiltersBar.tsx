import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { useDebounce } from '@/shared/lib/useDebounce';
import type { useProductFilters } from './useProductFilters';

interface Props {
  filters: ReturnType<typeof useProductFilters>;
}

export function ProductFiltersBar({ filters: { filters, setFilter } }: Props): ReactElement {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);

  const [localPriceMin, setLocalPriceMin] = useState(filters.retail_price_min);
  const debouncedPriceMin = useDebounce(localPriceMin, 500);

  const [localPriceMax, setLocalPriceMax] = useState(filters.retail_price_max);
  const debouncedPriceMax = useDebounce(localPriceMax, 500);

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilter('search', debouncedSearch);
  }, [debouncedSearch, filters.search, setFilter]);

  useEffect(() => {
    if (debouncedPriceMin !== filters.retail_price_min) setFilter('retail_price_min', debouncedPriceMin);
  }, [debouncedPriceMin, filters.retail_price_min, setFilter]);

  useEffect(() => {
    if (debouncedPriceMax !== filters.retail_price_max) setFilter('retail_price_max', debouncedPriceMax);
  }, [debouncedPriceMax, filters.retail_price_max, setFilter]);

  useEffect(() => {
    if (filters.search !== localSearch && filters.search !== debouncedSearch) setLocalSearch(filters.search);
    if (filters.retail_price_min !== localPriceMin && filters.retail_price_min !== debouncedPriceMin) setLocalPriceMin(filters.retail_price_min);
    if (filters.retail_price_max !== localPriceMax && filters.retail_price_max !== debouncedPriceMax) setLocalPriceMax(filters.retail_price_max);
  }, [filters.search, localSearch, debouncedSearch, filters.retail_price_min, localPriceMin, debouncedPriceMin, filters.retail_price_max, localPriceMax, debouncedPriceMax]);

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories({ page_size: 500 }),
  });

  const brands = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: () => catalogApi.brands({ page_size: 500 }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            className="field pl-9 h-10 w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            placeholder="Nomi, SKU yoki Shtrix-kod..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              onClick={() => setLocalSearch('')}
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category */}
        <select
          className="field h-10 w-full sm:w-40 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
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

        {/* Brand */}
        <select
          className="field h-10 w-full sm:w-36 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
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

        {/* Status */}
        <select
          className="field h-10 w-full sm:w-32 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          value={filters.is_active}
          onChange={(e) => setFilter('is_active', e.target.value)}
          aria-label="Holatni tanlang"
        >
          <option value="">Barcha holatlar</option>
          <option value="true">Faol</option>
          <option value="false">Nofaol</option>
        </select>

        {/* Stock Status */}
        <select
          className="field h-10 w-full sm:w-36 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          value={filters.stock_status}
          onChange={(e) => setFilter('stock_status', e.target.value)}
          aria-label="Zaxira holatini tanlang"
        >
          <option value="">Barcha zaxiralar</option>
          <option value="ok">Yaxshi (Qoldiq bor)</option>
          <option value="low">Kam qoldiq</option>
          <option value="out">Tugagan</option>
        </select>

        {/* Price Min/Max */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="field h-10 w-24 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
            placeholder="Min narx"
            value={localPriceMin}
            onChange={(e) => setLocalPriceMin(e.target.value)}
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
            className="field h-10 w-24 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 placeholder:text-slate-400"
            placeholder="Max narx"
            value={localPriceMax}
            onChange={(e) => setLocalPriceMax(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
