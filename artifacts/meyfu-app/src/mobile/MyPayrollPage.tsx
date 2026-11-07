import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { advanceApi, payrollApi } from '@/shared/api/payroll';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-gray-400',
  APPROVED: 'text-pending',
  PAID: 'text-success',
};

export function MyPayrollPage(): ReactElement {
  const payrolls = useQuery({
    queryKey: ['payrolls', 'my'],
    queryFn: () => payrollApi.my(),
  });
  const advances = useQuery({
    queryKey: ['advances', 'my'],
    queryFn: () => advanceApi.my(),
  });

  const rows = payrolls.data ?? [];
  const pendingAdvances = (advances.data?.results ?? []).filter((a) => !a.payroll);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mening maoshim</h1>

      {pendingAdvances.length > 0 && (
        <div className="rounded-xl bg-pending/10 p-3 text-sm text-pending">
          Hisobga olinmagan avans:{' '}
          {money(
            pendingAdvances
              .reduce((s, a) => s + Number(a.amount), 0)
              .toString(),
          )}
        </div>
      )}

      <DataState
        isLoading={payrolls.isLoading}
        isError={payrolls.isError}
        isEmpty={!payrolls.isLoading && rows.length === 0}
        emptyText="Hali maosh hisoblanmagan"
      >
        <ul className="space-y-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.period.slice(0, 7)}</span>
                <span className={`text-sm ${STATUS_CLASS[p.status] ?? 'text-gray-500'}`}>
                  {p.status_display}
                </span>
              </div>
              <div className="text-2xl font-bold">{money(p.final_amount)}</div>
              <div className="space-y-0.5 text-xs text-gray-500">
                <Line label="Asosiy maosh" value={money(p.base_salary)} />
                <Line
                  label="Komissiya"
                  value={money(p.commission_amount)}
                  hint={`${money(p.total_sales)} sotuv`}
                />
                {Number(p.order_commission_amount) > 0 && (
                  <Line
                    label="↳ zakaz olgani"
                    value={money(p.order_commission_amount)}
                  />
                )}
                {Number(p.delivery_commission_amount) > 0 && (
                  <Line
                    label="↳ yetkazgani"
                    value={money(p.delivery_commission_amount)}
                  />
                )}
                {Number(p.bonus) > 0 && (
                  <Line label="Bonus" value={`+${money(p.bonus)}`} />
                )}
                {Number(p.reimbursement_expense) > 0 && (
                  <Line
                    label="Xarajat qaytarimi"
                    value={`+${money(p.reimbursement_expense)}`}
                  />
                )}
                {Number(p.total_deductions) > 0 && (
                  <Line
                    label="Ushlanmalar"
                    value={`−${money(p.total_deductions)}`}
                    danger
                  />
                )}
              </div>
              {p.status === 'DRAFT' && (
                <div className="text-xs text-gray-400">
                  Taxminiy — hali tasdiqlanmagan, o'zgarishi mumkin.
                </div>
              )}
              {p.paid_at && (
                <div className="text-xs text-success">
                  To'landi · {dateShort(p.paid_at)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}

function Line({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}): ReactElement {
  return (
    <div className="flex justify-between">
      <span>
        {label}
        {hint && <span className="text-gray-400"> · {hint}</span>}
      </span>
      <span className={danger ? 'text-danger' : ''}>{value}</span>
    </div>
  );
}
