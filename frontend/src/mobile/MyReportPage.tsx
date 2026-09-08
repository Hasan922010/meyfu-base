import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { reports360Api, type PeriodPreset } from '@/shared/api/reports360';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

const PRESETS: Array<{ v: PeriodPreset; l: string }> = [
  { v: 'today', l: 'Bugun' },
  { v: 'week', l: 'Hafta' },
  { v: 'month', l: 'Oy' },
];

export function MyReportPage(): ReactElement {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const [preset, setPreset] = useState<PeriodPreset>('today');

  const query = useQuery({
    queryKey: ['my-360', preset],
    queryFn: () => reports360Api.full(userId, { preset }),
    enabled: Boolean(userId),
  });

  const d = query.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mening hisobotim</h1>

      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            onClick={() => setPreset(p.v)}
            className={`flex-1 rounded-lg py-2 text-sm ${
              preset === p.v
                ? 'bg-brand text-brand-fg'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
            }`}
          >
            {p.l}
          </button>
        ))}
      </div>

      <DataState isLoading={query.isLoading} isError={query.isError}>
        {d && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Savdo" value={money(d.sales.total_amount)} />
              <Stat
                label="Sof foyda"
                value={money(d.sales.total_profit)}
                accent="text-success"
              />
              <Stat label="Sotuvlar" value={String(d.sales.sales_count)} />
              <Stat label="O'rtacha chek" value={money(d.sales.avg_check)} />
              <Stat label="Naqd yig'ildi" value={money(d.money.cash_collected)} />
              <Stat
                label="Xarajat"
                value={money(d.money.expenses_total)}
                accent="text-expense"
              />
              <Stat label="Qarzga berdim" value={money(d.debts.given_total)} />
              <Stat label="Qarz undirdim" value={money(d.debts.collected_total)} />
            </div>

            {(d.orders.taken_count > 0 || d.orders.delivered_count > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Zakaz yig'dim"
                  value={`${d.orders.taken_count} ta · ${money(d.orders.taken_amount)}`}
                />
                <Stat
                  label="Yetkazdim"
                  value={`${d.orders.delivered_count} ta · ${money(
                    d.orders.delivered_amount,
                  )}`}
                />
              </div>
            )}

            {d.sales.plan_completion_percent !== null && (
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Oylik reja</span>
                  <span className="font-semibold">
                    {d.sales.plan_completion_percent}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.min(100, d.sales.plan_completion_percent)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {money(d.sales.total_amount)} / {money(d.sales.plan)}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-4 text-white">
              <div className="text-xs opacity-80">
                Taxminiy maosh ({d.payroll.period.slice(0, 7)})
              </div>
              <div className="mt-1 text-3xl font-bold">
                {money(d.payroll.estimated_total)}
              </div>
              <div className="mt-2 space-y-0.5 text-xs opacity-90">
                <div className="flex justify-between">
                  <span>Asosiy maosh</span>
                  <span>{money(d.payroll.base_salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Komissiya</span>
                  <span>{money(d.payroll.commission_earned)}</span>
                </div>
                {Number(d.payroll.order_commission) > 0 && (
                  <div className="flex justify-between opacity-80">
                    <span>↳ zakaz olgani</span>
                    <span>{money(d.payroll.order_commission)}</span>
                  </div>
                )}
                {Number(d.payroll.delivery_commission) > 0 && (
                  <div className="flex justify-between opacity-80">
                    <span>↳ yetkazgani</span>
                    <span>{money(d.payroll.delivery_commission)}</span>
                  </div>
                )}
                {Number(d.payroll.advances) > 0 && (
                  <div className="flex justify-between">
                    <span>Avans</span>
                    <span>−{money(d.payroll.advances)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

function Stat({
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
      <div className={`mt-1 font-bold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}
