import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { qty } from '@/shared/lib/format';

export function StockTab(): ReactElement {
  const [onlyLow, setOnlyLow] = useState<boolean>(false);

  const stock = useQuery({
    queryKey: ['stock'],
    queryFn: () => warehouseApi.stock({ page_size: 100, ordering: 'product__name' }),
    enabled: !onlyLow,
  });
  const low = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: () => warehouseApi.lowStock(),
    enabled: onlyLow,
  });

  const rows = onlyLow ? (low.data ?? []) : (stock.data?.results ?? []);
  const isLoading = onlyLow ? low.isLoading : stock.isLoading;
  const isError = onlyLow ? low.isError : stock.isError;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyLow}
          onChange={(e) => setOnlyLow(e.target.checked)}
        />
        Faqat kam qolganlar
      </label>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && rows.length === 0}
          emptyText="Qoldiq yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Mahsulot</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Ombor</th>
                <th className="p-3 text-right">Qoldiq</th>
                <th className="p-3 text-right">Band</th>
                <th className="p-3 text-right">Mavjud</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-medium">{s.product_name}</td>
                  <td className="p-3 font-mono text-xs">{s.product_sku}</td>
                  <td className="p-3">{s.warehouse_name}</td>
                  <td className="p-3 text-right">{qty(s.quantity)}</td>
                  <td className="p-3 text-right text-gray-500">
                    {qty(s.reserved_quantity)}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {qty(s.available_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}
