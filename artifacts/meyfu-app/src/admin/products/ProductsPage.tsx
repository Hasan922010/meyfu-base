import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactElement } from 'react';
import { Download, Plus, RefreshCcw } from 'lucide-react';

import { catalogApi } from '@/shared/api/catalog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';
import type { Product } from '@/shared/types/catalog';

import { ProductForm } from './ProductForm';
import { ProductImport } from './ProductImport';
import { useProductFilters } from './useProductFilters';
import { ProductFiltersBar } from './ProductFiltersBar';
import { ProductTable } from './ProductTable';
import { ProductMobileCards } from './ProductMobileCards';
import { ProductBulkToolbar } from './ProductBulkToolbar';

function ProductsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export function ProductsPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const filterHook = useProductFilters();
  const { filters, setFilter, clearFilters } = filterHook;

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    filters.search,
    filters.page,
    filters.page_size,
    filters.category,
    filters.brand,
    filters.is_active,
    filters.stock_status,
    filters.retail_price_min,
    filters.retail_price_max,
    filters.ordering,
  ]);

  const queryParams = {
    search: filters.search || undefined,
    page: filters.page,
    page_size: filters.page_size,
    category: filters.category || undefined,
    brand: filters.brand || undefined,
    is_active: filters.is_active || undefined,
    stock_status: filters.stock_status || undefined,
    retail_price_min: filters.retail_price_min || undefined,
    retail_price_max: filters.retail_price_max || undefined,
    ordering: filters.ordering || undefined,
  };

  const query = useQuery({
    queryKey: ['products', queryParams],
    queryFn: ({ signal }) => catalogApi.products(queryParams, signal),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const handleSort = (field: string) => {
    if (filters.ordering === field) {
      setFilter('ordering', `-${field}`);
    } else if (filters.ordering === `-${field}`) {
      setFilter('ordering', '');
    } else {
      setFilter('ordering', field);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await catalogApi.exportProducts(queryParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mahsulotlar.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.brand || filters.is_active || filters.stock_status || filters.retail_price_min || filters.retail_price_max
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-24 relative min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Mahsulotlar
            <button
              onClick={() => query.refetch()}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                query.isFetching ? 'animate-spin text-brand' : ''
              }`}
              title="Yangilash"
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          </h1>
          {query.data && (
            <p className="text-sm text-slate-500 mt-1">
              Jami: {query.data.count} ta mahsulot
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 flex items-center gap-2 font-medium"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Eksport</span>
          </button>

          {canWrite && (
            <button className="btn px-4" onClick={() => setImporting(true)}>
              Excel'dan import
            </button>
          )}
          {canWrite && (
            <button
              className="btn-brand px-4 flex items-center gap-2"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Yangi mahsulot
            </button>
          )}
        </div>
      </div>

      <ProductFiltersBar filters={filterHook} />

      <DataState
        isLoading={query.isLoading}
        loadingComponent={<ProductsSkeleton />}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText={hasActiveFilters ? "Bunday mahsulot topilmadi" : "Mahsulotlar yo'q"}
      >
        {rows.length === 0 && hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-slate-200 border-dashed dark:border-slate-800">
            <p className="text-slate-500 mb-4">Filtrlarga mos mahsulot topilmadi.</p>
            <button className="btn" onClick={clearFilters}>Filtrlarni tozalash</button>
          </div>
        ) : rows.length === 0 && !hasActiveFilters && canWrite ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-slate-200 border-dashed dark:border-slate-800">
            <p className="text-slate-500 mb-4">Katalog bo'sh. Birinchi mahsulotni qo'shing.</p>
            <button className="btn-brand" onClick={() => setCreating(true)}>Yangi mahsulot yaratish</button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ProductTable
              rows={rows}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
              onEdit={setEditing}
              canWrite={canWrite}
              ordering={filters.ordering}
              onSort={handleSort}
            />
            <ProductMobileCards
              rows={rows}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onEdit={setEditing}
              canWrite={canWrite}
            />
          </div>
        )}
      </DataState>

      {query.data && query.data.pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Ko‘rsatish:
            <select
              className="field py-1 px-2 h-auto text-sm"
              value={filters.page_size}
              onChange={(e) => setFilter('page_size', e.target.value)}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn px-3 py-1.5 h-auto text-sm disabled:opacity-50"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', String(filters.page - 1))}
            >
              Oldingi
            </button>
            <span className="text-sm font-medium px-2 tabular-nums">
              {filters.page} / {query.data.pages}
            </span>
            <button
              className="btn px-3 py-1.5 h-auto text-sm disabled:opacity-50"
              disabled={filters.page >= query.data.pages}
              onClick={() => setFilter('page', String(filters.page + 1))}
            >
              Keyingi
            </button>
          </div>
        </div>
      )}

      {canWrite && (
        <ProductBulkToolbar
          selectedIds={selectedIds}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <Modal
        open={creating || editing !== null}
        title={editing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        {(creating || editing !== null) && (
          <ProductForm
            product={editing}
            onDone={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </Modal>
      <Modal
        open={importing}
        title="Mahsulotlarni Excel'dan import"
        size="lg"
        onClose={() => setImporting(false)}
      >
        {importing && <ProductImport onDone={() => setImporting(false)} />}
      </Modal>
    </div>
  );
}
