import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { reportsApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }): ReactElement {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

export function DashboardPage(): ReactElement {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard(),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      <DataState isLoading={query.isLoading} isError={query.isError}>
        {query.data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Bugungi savdo" value={money(query.data.kpi.sales_total)} />
              <Kpi label="Sof foyda" value={money(query.data.kpi.profit)} accent="text-success" />
              <Kpi label="Naqd tushdi" value={money(query.data.kpi.cash_in)} />
              <Kpi label="Qarzga berildi" value={money(query.data.kpi.debt_given)} accent="text-expense" />
              <Kpi label="Qarz undirildi" value={money(query.data.kpi.debt_collected)} />
              <Kpi label="Sotuvlar soni" value={String(query.data.kpi.sales_count)} />
              <Kpi
                label="Umumiy qarzdorlik"
                value={money(query.data.kpi.outstanding_debt)}
                accent="text-danger"
              />
              <Kpi
                label="Belgilangan sotuvlar"
                value={String(query.data.kpi.flagged_sales)}
                accent={query.data.kpi.flagged_sales > 0 ? 'text-pending' : ''}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <h2 className="mb-2 font-semibold">Tarqatuvchilar (bugun)</h2>
                <ul className="space-y-1 text-sm">
                  {query.data.by_distributor.map((d) => (
                    <li key={d.name} className="flex justify-between">
                      <span>{d.name}</span>
                      <span className="font-medium">{money(d.amount)} · {d.count}</span>
                    </li>
                  ))}
                  {query.data.by_distributor.length === 0 && (
                    <li className="text-gray-400">Bugun sotuv yo'q</li>
                  )}
                </ul>
              </section>

              <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <h2 className="mb-2 font-semibold">TOP mahsulotlar</h2>
                <ul className="space-y-1 text-sm">
                  {query.data.top_products.map((p) => (
                    <li key={p.name} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="font-medium">{money(p.amount)}</span>
                    </li>
                  ))}
                  {query.data.top_products.length === 0 && (
                    <li className="text-gray-400">—</li>
                  )}
                </ul>
              </section>
            </div>

            <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
              <h2 className="mb-2 font-semibold">Jonli lenta</h2>
              <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
                {query.data.recent_sales.map((s) => (
                  <li key={s.number} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-mono text-xs text-gray-400">{s.number}</span>{' '}
                      {s.client} · {s.distributor}
                    </span>
                    <span className="flex items-center gap-2">
                      {s.flagged && (
                        <TriangleAlert size={14} className="text-pending" aria-label="Belgilangan" />
                      )}
                      <span className="font-medium">{money(s.amount)}</span>
                    </span>
                  </li>
                ))}
                {query.data.recent_sales.length === 0 && (
                  <li className="py-4 text-center text-gray-400">Bugun sotuv yo'q</li>
                )}
              </ul>
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}
