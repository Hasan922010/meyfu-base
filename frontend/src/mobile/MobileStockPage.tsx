import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { qty } from '@/shared/lib/format';

export function MobileStockPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const query = useQuery({
    queryKey: ['stock', 'mobile'],
    queryFn: () => warehouseApi.stock({ page_size: 500, ordering: 'product__name' }),
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
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
              >
                <span>
                  {s.product_name}
                  <span className="ml-2 text-xs text-gray-400">{s.product_sku}</span>
                  {low && (
                    <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-xs text-danger">
                      Kam qoldi
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${low ? 'text-danger' : ''}`}>
                    {qty(s.quantity)} {s.product_unit}
                  </span>
                  {reserved > 0 && (
                    <span className="block text-xs text-gray-400">band: {qty(reserved)}</span>
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
