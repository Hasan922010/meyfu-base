import { useQuery } from '@tanstack/react-query';
import { Download, Gift, Package, TrendingUp } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import {
  downloadBlob,
  reportsAdvancedApi,
  type ProductMovementRow,
} from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { money, qty } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';
import type { Category } from '@/shared/types/catalog';

interface Props {
  range: { date_from: string; date_to: string };
}

export function ProductMovementTab({ range }: Props): ReactElement {
  const toast = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);

  const categoriesQuery = useQuery({
    queryKey: ['categories-for-movement'],
    queryFn: () => catalogApi.categories({ page_size: 200 }),
  });

  const categories = useMemo((): Category[] => {
    const d = categoriesQuery.data;
    if (!d) return [];
    if (Array.isArray(d)) return d as Category[];
    if (Array.isArray((d as { results?: Category[] }).results)) {
      return (d as { results: Category[] }).results;
    }
    return [];
  }, [categoriesQuery.data]);

  const query = useQuery({
    queryKey: ['product-movement-report', range, selectedCategory],
    queryFn: () =>
      reportsAdvancedApi.productMovement({
        ...range,
        category_id: selectedCategory || undefined,
      }),
  });

  const summary = query.data?.summary;
  const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r: ProductMovementRow) =>
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.product_sku || '').toLowerCase().includes(q) ||
        (r.category_name || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      const blob = await reportsAdvancedApi.exportProductMovement({
        ...range,
        category_id: selectedCategory || undefined,
      });
      downloadBlob(blob, `tovar-harakati-${range.date_from}-${range.date_to}.xlsx`);
      toast.push({ kind: 'success', title: 'Excel fayl muvaffaqiyatli yuklab olindi' });
    } catch {
      toast.push({ kind: 'danger', title: 'Eksport qilishda xatolik yuz berdi' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtrlar va Excel yuklash */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-sm border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="field min-h-[44px] w-64 text-sm"
            placeholder="Tovar nomi yoki artikul…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="field min-h-[44px] w-52 text-sm"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Barcha kategoriyalar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || rows.length === 0}
          className="btn min-h-[44px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl flex items-center gap-2 shadow-xs transition disabled:opacity-50"
        >
          <Download size={16} aria-hidden />
          <span>{exporting ? 'Yuklanmoqda…' : 'Excel yuklash'}</span>
        </button>
      </div>

      {/* KPI Kartochkalari */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card-minimal space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <TrendingUp size={16} className="text-brand" />
              <span>Jami Pullik Sotuv</span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-gray-100">
              {money(summary.total_sold_amount)}
            </div>
            <div className="text-xs text-gray-500">{summary.total_sold_qty} dona sotildi</div>
          </div>

          <div className="card-minimal space-y-1 bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/40">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <Gift size={16} />
              <span>Aksiya Bonusi (BEPUL)</span>
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.total_bonus_qty} dona
            </div>
            <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              Tannarxi: {money(summary.total_bonus_cost)}
            </div>
          </div>

          <div className="card-minimal space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <Package size={16} className="text-amber-600" />
              <span>Jami Ombor Chiqimi</span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-gray-100">
              {summary.total_movement_qty} dona
            </div>
            <div className="text-xs text-gray-500">Sotuv + Bepul bonuslar</div>
          </div>

          <div className="card-minimal space-y-1">
            <span className="text-xs text-gray-500 font-medium">Aksiya Ulushi</span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {summary.bonus_ratio_percent}%
            </div>
            <div className="text-xs text-gray-400">Chiqimdagi bonus tovarlar</div>
          </div>
        </div>
      )}

      {/* Jadval */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && filteredRows.length === 0}
          emptyText="Ushbu oraliqda tovar harakati topilmadi"
        >
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/75 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="p-3.5">Mahsulot</th>
                <th className="p-3.5">Kategoriya</th>
                <th className="p-3.5 text-right">Sotilgan (pullik)</th>
                <th className="p-3.5 text-right">Sotuv summasi</th>
                <th className="p-3.5 text-right">Bonus (bepul)</th>
                <th className="p-3.5 text-right">Bonus tannarxi</th>
                <th className="p-3.5 text-right">Jami chiqim</th>
                <th className="p-3.5 text-right">O‘rtacha narx</th>
                <th className="p-3.5 text-right">Sotuvlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRows.map((r) => {
                const hasBonusGiven = Number(r.bonus_qty) > 0;
                return (
                  <tr
                    key={r.product_id}
                    className="hover:bg-gray-50/75 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.product_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{r.product_sku}</div>
                    </td>
                    <td className="p-3.5 text-gray-500 text-xs">{r.category_name}</td>
                    <td className="p-3.5 text-right font-medium">
                      {qty(r.sold_qty)} {r.unit}
                    </td>
                    <td className="p-3.5 text-right font-bold text-gray-900 dark:text-gray-100">
                      {money(r.sold_amount)}
                    </td>
                    <td className="p-3.5 text-right">
                      {hasBonusGiven ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <Gift size={12} />
                          <span>+{qty(r.bonus_qty)} {r.unit}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">0</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right text-xs text-gray-500">
                      {hasBonusGiven ? money(r.bonus_cost) : '—'}
                    </td>
                    <td className="p-3.5 text-right font-extrabold text-brand">
                      {qty(r.total_qty)} {r.unit}
                    </td>
                    <td className="p-3.5 text-right text-xs text-gray-600 dark:text-gray-300">
                      {money(r.avg_price)}
                    </td>
                    <td className="p-3.5 text-right text-xs text-gray-500">{r.sales_count}</td>
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

