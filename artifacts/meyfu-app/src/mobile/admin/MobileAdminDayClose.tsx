import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { dayCloseApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money, qty } from '@/shared/lib/format';

export function MobileAdminDayClose(): ReactElement {
  const qc = useQueryClient();
  const [onlyDiff, setOnlyDiff] = useState<boolean>(false);
  const [open, setOpen] = useState<string>('');

  const query = useQuery({
    queryKey: ['day-close', { onlyDiff }],
    queryFn: () =>
      dayCloseApi.list({
        has_difference: onlyDiff ? 'true' : undefined,
        page_size: 50,
        ordering: '-date',
      }),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => dayCloseApi.confirm(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-close'] });
      void qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Kunlik hisob</h1>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyDiff}
          onChange={(e) => setOnlyDiff(e.target.checked)}
        />
        Faqat farqli kunlar
      </label>

      {confirm.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(confirm.error)}
        </p>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Yozuv yo'q"
      >
        <ul className="space-y-2">
          {rows.map((d) => (
            <li
              key={d.id}
              className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setOpen(open === d.id ? '' : d.id)}
              >
                <div>
                  <div className="font-medium">{d.distributor_name}</div>
                  <div className="text-xs text-gray-500">{dateShort(d.date)}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm ${
                      d.status === 'CLOSED' ? 'text-success' : 'text-pending'
                    }`}
                  >
                    {d.status_display}
                  </div>
                  {d.has_difference && (
                    <div className="text-xs text-danger">farq bor</div>
                  )}
                </div>
              </button>

              {open === d.id && (
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
                  <Row label="Sotildi" value={money(d.sold_amount)} />
                  <Row label="Naqd sotuv" value={money(d.cash_sales_amount)} />
                  <Row
                    label="Undirilgan qarz"
                    value={money(d.debt_collected_amount)}
                  />
                  <Row label="Kutilgan kassa" value={money(d.cash_expected)} />
                  <Row label="Topshirilgan" value={money(d.cash_handed_amount)} />
                  <Row
                    label="Kassa farqi"
                    value={money(d.cash_difference)}
                    danger={Number(d.cash_difference) < 0}
                  />
                  <Row
                    label="Tovar farqi"
                    value={`${qty(d.stock_difference_qty)} (${money(
                      d.stock_difference_amount,
                    )})`}
                    danger={Number(d.stock_difference_qty) !== 0}
                  />
                  {d.note && (
                    <p className="pt-1 text-xs text-gray-400">Izoh: {d.note}</p>
                  )}
                  {d.status === 'PENDING' && (
                    <button
                      className="btn-brand mt-2 w-full"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(d.id)}
                    >
                      Tasdiqlash (kunni yopish)
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}

function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}): ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={danger ? 'font-semibold text-danger' : ''}>{value}</span>
    </div>
  );
}
