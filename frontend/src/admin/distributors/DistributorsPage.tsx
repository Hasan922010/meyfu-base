import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import {
  reports360Api,
  type ComparisonRow,
  type PeriodPreset,
} from '@/shared/api/reports360';
import { DataState } from '@/shared/components/DataState';
import { PeriodSwitcher } from '@/shared/components/PeriodSwitcher';
import { money } from '@/shared/lib/format';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DistributorsPage(): ReactElement {
  const [preset, setPreset] = useState<PeriodPreset>('month');

  const query = useQuery({
    queryKey: ['distributor-comparison', preset],
    queryFn: () => reports360Api.comparison({ preset }),
  });

  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Xodimlar</h1>
        <PeriodSwitcher value={preset} onChange={setPreset} />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Tarqatuvchi yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3 text-right">Sotuv</th>
                <th className="p-3 text-right">Foyda</th>
                <th className="p-3 text-right">Sotuvlar</th>
                <th className="p-3 text-right">O'rt. chek</th>
                <th className="p-3 text-right">Naqd yig'ildi</th>
                <th className="p-3 text-right">Xarajat</th>
                <th className="p-3 text-right">Reja %</th>
                <th className="p-3 text-right">Kamomad kunlari</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: ComparisonRow) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                >
                  <td className="p-3">{MEDAL[r.rank] ?? r.rank}</td>
                  <td className="p-3 font-medium">
                    <Link
                      to={`/admin/distributors/${r.id}`}
                      className="text-brand hover:underline"
                    >
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-semibold">{money(r.sales)}</td>
                  <td className="p-3 text-right text-success">{money(r.profit)}</td>
                  <td className="p-3 text-right">{r.sales_count}</td>
                  <td className="p-3 text-right">{money(r.avg_check)}</td>
                  <td className="p-3 text-right">{money(r.cash_collected)}</td>
                  <td className="p-3 text-right text-expense">{money(r.expenses)}</td>
                  <td className="p-3 text-right">
                    {r.plan_completion_percent === null
                      ? '—'
                      : `${r.plan_completion_percent}%`}
                  </td>
                  <td
                    className={`p-3 text-right ${
                      r.shortage_days > 0 ? 'text-danger' : ''
                    }`}
                  >
                    {r.shortage_days}
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
