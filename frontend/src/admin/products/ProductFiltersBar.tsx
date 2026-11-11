import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

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
    if (debouncedPriceMin !== filters.retail_price_min) {
      setFilter('retail_price_min', debouncedPriceMin);
    }
  }, [debouncedPriceMin, filters.retail_price_min, setFilter]);

  useEffect(() => {
    if (debouncedPriceMax !== filters.retail_price_max) {
      setFilter('retail_price_max', debouncedPriceMax);
    }
  }, [debouncedPriceMax, filters.retail_price_max, setFilter]);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setLocalPriceMin(filters.retail_price_min);
  }, [filters.retail_price_min]);

  useEffect(() => {
    setLocalPriceMax(filters.retail_price_max);
  }, [filters.retail_price_max]);

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories({ page_size: 500 }),
  });

  const brands = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: () => catalogApi.brands({ page_size: 500 }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            className="field h-10 w-full border-slate-200 bg-slate-50 pl-9 dark:border-slate-700 dark:bg-slate-800"
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
            className="field h-10 w-24 border-slate-200 bg-slate-50 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800"
            placeholder="Min narx"
            value={localPriceMin}
            onChange={(e) => setLocalPriceMin(e.target.value)}
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
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

