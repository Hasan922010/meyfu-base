import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money, qty } from '@/shared/lib/format';

interface Props {
  range: { date_from: string; date_to: string };
}

export function PriceVarianceTab({ range }: Props): ReactElement {
  const [allProducts, setAllProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');

  const productsQuery = useQuery({
    queryKey: ['products-for-variance'],
    queryFn: () => catalogApi.products({ page_size: 300 }),
  });

  const query = useQuery({
    queryKey: ['price-variance-report', range, allProducts, selectedProduct],
    queryFn: () =>
      reportsAdvancedApi.priceVariance({
        ...range,
        all_products: allProducts ? 'true' : undefined,
        product_id: selectedProduct || undefined,
      }),
  });

  const summary = query.data?.summary;
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allProducts}
              onChange={(e) => setAllProducts(e.target.checked)}
            />
            <span>Barcha tovarlar bo‘yicha ko‘rish (faqat belgilanganlar emas)</span>
          </label>

          <select
            className="field text-sm"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">Barcha mahsulotlar</option>
            {productsQuery.data?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Tovarlar profilida belgilangan tannarxdan qimmat/arzon sotilgan operatsiyalar
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
            <span className="text-xs text-gray-500">Jami sotuv summasi</span>
            <div className="mt-1 text-lg font-bold">{money(summary.total_amount)}</div>
            <span className="text-xs text-gray-400">{summary.total_quantity} dona/birlik</span>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
            <span className="text-xs text-gray-500">Jami tannarx</span>
            <div className="mt-1 text-lg font-bold text-gray-700 dark:text-gray-300">
              {money(summary.total_cost)}
            </div>
          </div>
          <div className="rounded-xl bg-danger/5 p-3 shadow-sm dark:bg-danger/10">
            <span className="text-xs font-medium text-danger">Jami Kamomad (zarar)</span>
            <div className="mt-1 text-lg font-bold text-danger">
              -{money(summary.total_kamomad)}
            </div>
            <span className="text-xs text-danger/80">Tannarxdan past sotilgan qismi</span>
          </div>
          <div className="rounded-xl bg-success/5 p-3 shadow-sm dark:bg-success/10">
            <span className="text-xs font-medium text-success">Jami Ortiqcha (foyda)</span>
            <div className="mt-1 text-lg font-bold text-success">
              +{money(summary.total_ortiqcha)}
            </div>
            <span className="text-xs text-success/80">Tannarxdan qimmat sotilgan qismi</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Ushbu davrda belgilangan tovarlar bo‘yicha sotuvlar topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Tovar nomi</th>
                <th className="p-3 text-right">Soni</th>
                <th className="p-3 text-right">Tannarx</th>
                <th className="p-3 text-right">Narxi</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3 text-right text-danger">Kamomad</th>
                <th className="p-3 text-right text-success">Ortiqcha</th>
                <th className="p-3">Tarqatuvchi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isDeficit = Number(r.kamomad) > 0;
                const isSurplus = Number(r.ortiqcha) > 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <td className="p-3 font-mono text-xs">{dateShort(r.date)}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.product_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.product_sku}</div>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {qty(r.quantity)} {r.unit}
                    </td>
                    <td className="p-3 text-right text-gray-500">{money(r.cost_price)}</td>
                    <td className="p-3 text-right font-medium">{money(r.price)}</td>
                    <td className="p-3 text-right font-semibold">{money(r.amount)}</td>
                    <td className="p-3 text-right font-semibold">
                      {isDeficit ? (
                        <span className="rounded bg-danger/10 px-2 py-0.5 text-danger">
                          -{money(r.kamomad)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {isSurplus ? (
                        <span className="rounded bg-success/10 px-2 py-0.5 text-success">
                          +{money(r.ortiqcha)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-600 dark:text-gray-400">
                      {r.distributor_name}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}

