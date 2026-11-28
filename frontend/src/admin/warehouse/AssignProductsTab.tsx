import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Search, Warehouse as WarehouseIcon } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { intQty, productUnitLabel } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';
import { useDebounce } from '@/shared/lib/useDebounce';

export function AssignProductsTab(): ReactElement {
  const qc = useQueryClient();
  const toast = useToast();

  const [filterWarehouse, setFilterWarehouse] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetWarehouse, setTargetWarehouse] = useState<string>('');

  const debouncedSearch = useDebounce(search, 250);

  const warehousesQ = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });

  const categoriesQ = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => catalogApi.categories({ page_size: 500 }),
  });

  const productsQ = useQuery({
    queryKey: [
      'products',
      'assign-warehouse',
      { filterWarehouse, debouncedSearch, category, page },
    ],
    queryFn: ({ signal }) =>
      catalogApi.products(
        {
          page,
          page_size: 50,
          search: debouncedSearch || undefined,
          category: category || undefined,
          warehouse:
            filterWarehouse && filterWarehouse !== '__unassigned__'
              ? filterWarehouse
              : undefined,
          unassigned: filterWarehouse === '__unassigned__' ? 'true' : undefined,
          ordering: 'name',
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  const assignMut = useMutation({
    mutationFn: (body: { ids: string[]; warehouse: string | null }) =>
      catalogApi.assignWarehouse(body),
    onSuccess: (res) => {
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ['products'] });
      toast.push({
        kind: 'success',
        title: res.warehouse_name
          ? `${res.updated} ta mahsulot «${res.warehouse_name}»ga biriktirildi`
          : `${res.updated} ta mahsulotdan ombor biriktiruvi olib tashlandi`,
      });
    },
    onError: (err) => {
      toast.push({ kind: 'danger', title: 'Xatolik', body: extractApiError(err) });
    },
  });

  const warehouses = warehousesQ.data?.results ?? [];
  const rows = productsQ.data?.results ?? [];
  const totalPages = productsQ.data?.pages ?? 1;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAssign = () => {
    if (selectedIds.size === 0 || !targetWarehouse) return;
    assignMut.mutate({
      ids: Array.from(selectedIds),
      warehouse: targetWarehouse === '__none__' ? null : targetWarehouse,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterWarehouse('');
            setPage(1);
            setSelectedIds(new Set());
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            filterWarehouse === ''
              ? 'border-brand bg-brand text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Barcha mahsulotlar
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterWarehouse('__unassigned__');
            setPage(1);
            setSelectedIds(new Set());
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            filterWarehouse === '__unassigned__'
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
          }`}
        >
          Ombor biriktirilmagan
        </button>
        {warehouses.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              setFilterWarehouse(w.id);
              setPage(1);
              setSelectedIds(new Set());
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filterWarehouse === w.id
                ? 'border-brand bg-brand text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <WarehouseIcon className="h-3.5 w-3.5" aria-hidden />
            {w.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="field h-10 w-full pl-9"
              placeholder="Nomi yoki SKU bo'yicha qidirish..."
              aria-label="Mahsulotlarni qidirish"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="field h-10 w-full sm:w-44"
            aria-label="Kategoriya bo'yicha filtr"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha kategoriyalar</option>
            {categoriesQ.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field h-10 w-full sm:w-52"
            aria-label="Biriktiriladigan omborni tanlang"
            value={targetWarehouse}
            onChange={(e) => setTargetWarehouse(e.target.value)}
          >
            <option value="">Omborni tanlang…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="__none__">Ombor biriktirishni yechish</option>
          </select>
          <button
            type="button"
            disabled={selectedIds.size === 0 || !targetWarehouse || assignMut.isPending}
            onClick={handleBulkAssign}
            className="btn-brand flex h-10 items-center gap-2 px-4 text-sm font-medium disabled:opacity-50"
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
            Omborga biriktirish ({selectedIds.size})
          </button>
        </div>
      </div>

      <DataState
        isLoading={productsQ.isLoading}
        isError={productsQ.isError}
        error={productsQ.error}
        onRetry={() => void productsQ.refetch()}
        isEmpty={!productsQ.isLoading && rows.length === 0}
        emptyText="Bu filtr bo'yicha mahsulot topilmadi."
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              <tr>
                <th className="w-12 p-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Sahifadagi barchasini tanlash"
                  />
                </th>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Mahsulot
                </th>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Kategoriya
                </th>
                <th className="p-3 text-right font-medium text-slate-600 dark:text-slate-300">
                  Qoldiq
                </th>
                <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">
                  Joriy ombor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`${p.name} ni tanlash`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                    <div className="font-mono text-xs text-slate-500">{p.sku}</div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{p.category_name}</td>
                  <td className="p-3 text-right tabular-nums">
                    {intQty(p.available_stock ?? 0)} {productUnitLabel(p)}
                  </td>
                  <td className="p-3">
                    <select
                      className="field h-9 w-48 text-xs"
                      aria-label={`${p.name} ombori`}
                      value={p.warehouse ?? ''}
                      disabled={assignMut.isPending}
                      onChange={(e) => {
                        const whId = e.target.value || null;
                        assignMut.mutate({ ids: [p.id], warehouse: whId });
                      }}
                    >
                      <option value="">Biriktirilmagan</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-sm text-slate-600 dark:text-slate-300">
            <span>
              Sahifa {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn px-3 py-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Oldingi
              </button>
              <button
                type="button"
                className="btn px-3 py-1"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
