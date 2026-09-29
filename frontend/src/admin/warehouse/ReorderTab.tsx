import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { DataState } from '@/shared/components/DataState';
import { dateShort, qty } from '@/shared/lib/format';

const STATUS: Record<string, { label: string; cls: string }> = {
  URGENT: { label: 'Shoshilinch', cls: 'bg-danger/10 text-danger' },
  SOON: { label: 'Tez orada', cls: 'bg-pending/10 text-pending' },
  OK: { label: 'Yetarli', cls: 'bg-success/10 text-success' },
};

const PERIODS = [7, 14, 28, 56, 90];
const COVERS = [7, 14, 21, 30];

/** v5 C1: o'rtacha kunlik sotuv asosida qoldiq prognozi va buyurtma tavsiyasi. */
export function ReorderTab(): ReactElement {
  const [days, setDays] = useState<number>(28);
  const [cover, setCover] = useState<number>(14);
  const [onlyNeeded, setOnlyNeeded] = useState<boolean>(true);

  const query = useQuery({
    queryKey: ['reorder', days, cover],
    queryFn: () => reportsAdvancedApi.reorder({ days, cover }),
    placeholderData: keepPreviousData,
  });
  const rows = (query.data?.rows ?? []).filter((r) => !onlyNeeded || r.status !== 'OK');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-gray-500">O‘rtacha sotuv davri</span>
          <select
            className="field"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {PERIODS.map((d) => (
              <option key={d} value={d}>
                oxirgi {d} kun
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-gray-500">Zaxira kerak</span>
          <select
            className="field"
            value={cover}
            onChange={(e) => setCover(Number(e.target.value))}
          >
            {COVERS.map((d) => (
              <option key={d} value={d}>
                {d} kunlik
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={onlyNeeded}
            onChange={(e) => setOnlyNeeded(e.target.checked)}
          />
          Faqat buyurtma kerak bo‘lganlar
        </label>
      </div>

      {query.data && (
        <p className="text-xs text-gray-500">
          {dateShort(query.data.since)} dan beri sotuv asosida. Mavjud = ombor + mashinalardagi
          qoldiq. Tavsiya qadoq soniga yaxlitlangan.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Hozircha buyurtma kerak emas — qoldiq yetarli"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Mahsulot</th>
                <th className="p-3 text-right">Kunlik sotuv</th>
                <th className="p-3 text-right">Omborda</th>
                <th className="p-3 text-right">Mashinalarda</th>
                <th className="p-3 text-right">Yetadi (kun)</th>
                <th className="p-3 text-right">Tavsiya</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <td className="p-3">
                    {r.name}
                    <span className="block font-mono text-xs text-gray-400">{r.sku}</span>
                  </td>
                  <td className="p-3 text-right">{qty(r.avg_daily)}</td>
                  <td className="p-3 text-right">{qty(r.stock)}</td>
                  <td className="p-3 text-right">{qty(r.on_vans)}</td>
                  <td className="p-3 text-right">{r.days_left ?? '—'}</td>
                  <td className="p-3 text-right font-semibold">
                    {Number(r.suggested) > 0 ? qty(r.suggested) : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status]?.cls ?? ''}`}>
                      {STATUS[r.status]?.label ?? r.status}
                    </span>
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
