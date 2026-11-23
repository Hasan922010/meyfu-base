import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { intQty, money, productUnitLabel } from '@/shared/lib/format';

export function StockTab(): ReactElement {
  const [onlyLow, setOnlyLow] = useState<boolean>(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  const summary = useQuery({
    queryKey: ['stock', 'summary'],
    queryFn: () => warehouseApi.stockSummary(),
  });
  const stock = useQuery({
    queryKey: ['stock', { warehouse: selectedWarehouse }],
    queryFn: () =>
      warehouseApi.stock({
        warehouse: selectedWarehouse || undefined,
        page_size: 500,
        ordering: 'product__name',
      }),
    enabled: !onlyLow,
  });
  const low = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: () => warehouseApi.lowStock(),
    enabled: onlyLow,
  });

  const rawRows = onlyLow ? (low.data ?? []) : (stock.data?.results ?? []);
  const rows =
    onlyLow && selectedWarehouse
      ? rawRows.filter((s) => s.warehouse === selectedWarehouse)
      : rawRows;
  const isLoading = onlyLow ? low.isLoading : stock.isLoading;
  const isError = onlyLow ? low.isError : stock.isError;
  const totalRowQty = rows.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
  const totalRowValue = rows.reduce(
    (acc, s) =>
      acc + (Number(s.stock_value ?? Number(s.quantity) * Number(s.cost_price ?? 0)) || 0),
    0,
  );

  return (
    <div className="space-y-3">
      {summary.data && summary.data.warehouses.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelectedWarehouse('')}
            className={`rounded-xl border p-3 text-left transition ${
              selectedWarehouse === ''
                ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
            }`}
          >
            <div className="text-xs text-gray-500">Barcha omborlar</div>
            <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
              {money(summary.data.total_value)}
            </div>
            <div className="text-xs text-gray-500">
              Jami qoldiq: <strong className="text-gray-700 dark:text-gray-300">{intQty(summary.data.total_quantity)}</strong>
            </div>
          </button>
          {summary.data.warehouses.map((w) => (
            <button
              key={w.warehouse}
              type="button"
              onClick={() =>
                setSelectedWarehouse((prev) => (prev === w.warehouse ? '' : w.warehouse))
              }
              className={`rounded-xl border p-3 text-left transition ${
                selectedWarehouse === w.warehouse
                  ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                  {w.warehouse_name}
                </span>
                <span>{w.items_count} xil</span>
              </div>
              <div className="mt-1 text-lg font-bold text-brand">{money(w.total_value)}</div>
              <div className="text-xs text-gray-500">
                Qoldiq: <strong className="text-gray-700 dark:text-gray-300">{intQty(w.total_quantity)}</strong>
              </div>
            </button>
          ))}
        </div>
      )}

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
                <th className="p-3 text-right">Tannarx</th>
                <th className="p-3 text-right">Qoldiq</th>
                <th className="p-3 text-right">Band</th>
                <th className="p-3 text-right">Mavjud</th>
                <th className="p-3 text-right">Jami summa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const unitLabel = productUnitLabel(s);
                const rowValue =
                  s.stock_value ?? String(Number(s.quantity) * Number(s.cost_price ?? 0));
                return (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-medium">{s.product_name}</td>
                  <td className="p-3 font-mono text-xs">{s.product_sku}</td>
                  <td className="p-3">{s.warehouse_name}</td>
                  <td className="p-3 text-right text-gray-500">
                    {s.cost_price != null ? money(s.cost_price) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {intQty(s.quantity)} {unitLabel}
                  </td>
                  <td className="p-3 text-right text-gray-500">
                    {intQty(s.reserved_quantity)} {unitLabel}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {intQty(s.available_quantity)} {unitLabel}
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">
                    {money(rowValue)}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <td className="p-3" colSpan={4}>Jami ({rows.length} qator)</td>
                <td className="p-3 text-right">{intQty(totalRowQty)}</td>
                <td className="p-3" colSpan={2} />
                <td className="p-3 text-right text-brand">{money(totalRowValue)}</td>
              </tr>
            </tfoot>
          </table>
        </DataState>
      </div>
    </div>
  );
}
