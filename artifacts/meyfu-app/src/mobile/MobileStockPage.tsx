import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { intQty, money, productUnitLabel } from '@/shared/lib/format';

export function MobileStockPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const summary = useQuery({
    queryKey: ['stock', 'summary'],
    queryFn: () => warehouseApi.stockSummary(),
  });
  const query = useQuery({
    queryKey: ['stock', 'mobile', { warehouse: selectedWarehouse }],
    queryFn: () =>
      warehouseApi.stock({
        warehouse: selectedWarehouse || undefined,
        page_size: 500,
        ordering: 'product__name',
      }),
  });

  const rows = (query.data?.results ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      s.product_name.toLowerCase().includes(q) ||
      s.product_sku.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Ombor qoldig‘i</h1>
      {summary.data && summary.data.warehouses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedWarehouse('')}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${
              selectedWarehouse === ''
                ? 'border-brand bg-brand/5 font-semibold'
                : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
            }`}
          >
            <div className="text-gray-500">Barchasi</div>
            <div className="text-sm font-bold text-brand">{money(summary.data.total_value)}</div>
            <div className="text-[11px] text-gray-500">{intQty(summary.data.total_quantity)} ta</div>
          </button>
          {summary.data.warehouses.map((w) => (
            <button
              key={w.warehouse}
              type="button"
              onClick={() =>
                setSelectedWarehouse((prev) => (prev === w.warehouse ? '' : w.warehouse))
              }
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${
                selectedWarehouse === w.warehouse
                  ? 'border-brand bg-brand/5 font-semibold'
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
              }`}
            >
              <div className="text-gray-600 dark:text-gray-300">{w.warehouse_name}</div>
              <div className="text-sm font-bold text-brand">{money(w.total_value)}</div>
              <div className="text-[11px] text-gray-500">{intQty(w.total_quantity)} ta</div>
            </button>
          ))}
        </div>
      )}
      <input
        className="field"
        placeholder="Mahsulot qidirish…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Topilmadi"
      >
        <ul className="space-y-2">
          {rows.map((s) => {
            const low = Number(s.min_stock_alert) > 0 && Number(s.quantity) <= Number(s.min_stock_alert);
            const reserved = Number(s.reserved_quantity);
            const unitLabel = productUnitLabel(s);
            const rowValue =
              s.stock_value ?? String(Number(s.quantity) * Number(s.cost_price ?? 0));
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
              >
                <span>
                  {s.product_name}
                  <span className="ml-2 text-xs text-gray-400">{s.product_sku}</span>
                  <span className="block text-xs text-gray-400">{s.warehouse_name}</span>
                  {low && (
                    <span className="mt-0.5 inline-block rounded bg-danger/10 px-1.5 py-0.5 text-xs text-danger">
                      Kam qoldi
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${low ? 'text-danger' : ''}`}>
                    {intQty(s.quantity)} {unitLabel}
                  </span>
                  <span className="block text-xs font-medium text-brand">{money(rowValue)}</span>
                  {reserved > 0 && (
                    <span className="block text-xs text-gray-400">band: {intQty(reserved)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </DataState>
    </div>
  );
}
