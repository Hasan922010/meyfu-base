import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { reportsApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MobileAdminReports(): ReactElement {
  const [range] = useState({ date_from: firstOfMonth(), date_to: today() });

  const pnl = useQuery({
    queryKey: ['report-pnl', range],
    queryFn: () => reportsAdvancedApi.profit(range),
  });
  const byDay = useQuery({
    queryKey: ['sales-summary', 'day', range],
    queryFn: () =>
      reportsApi.salesSummary({ group_by: 'day', ...range }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Hisobotlar</h1>
      <p className="text-xs text-gray-500">
        Davr: {range.date_from} — {range.date_to}
      </p>

      <DataState isLoading={pnl.isLoading} isError={pnl.isError}>
        {pnl.data && (
          <div className="grid grid-cols-2 gap-2">
            <Card label="Tushum" value={money(pnl.data.revenue)} />
            <Card
              label="Yalpi foyda"
              value={money(pnl.data.gross_profit)}
              accent="text-success"
            />
            <Card
              label="Tarqatuvchi xarajati"
              value={money(pnl.data.distributor_expenses)}
              accent="text-expense"
            />
            <Card
              label="Kompaniya xarajati"
              value={money(pnl.data.company_expenses)}
              accent="text-expense"
            />
            <Card
              label="Sof foyda"
              value={money(pnl.data.net_profit)}
              accent={
                Number(pnl.data.net_profit) < 0 ? 'text-danger' : 'text-success'
              }
            />
            <Card label="Kassa balansi" value={money(pnl.data.cash_balance)} />
          </div>
        )}
      </DataState>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Kunlik savdo</div>
        <DataState
          isLoading={byDay.isLoading}
          isError={byDay.isError}
          isEmpty={!byDay.isLoading && (byDay.data?.rows.length ?? 0) === 0}
          emptyText="Sotuv yo'q"
        >
          <ul className="space-y-2">
            {byDay.data?.rows.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
              >
                <span>{String(r.day ?? r.date ?? '')}</span>
                <span className="text-right">
                  <span className="font-medium">{money(String(r.amount))}</span>
                  {r.count != null && (
                    <span className="ml-2 text-xs text-gray-400">
                      {String(r.count)} ta
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}
