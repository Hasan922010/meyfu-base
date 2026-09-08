import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { dayCloseApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money, qty } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { DayClose } from '@/shared/types/dayclose';

export function DayClosePage(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [onlyDiff, setOnlyDiff] = useState<boolean>(false);
  const [detail, setDetail] = useState<DayClose | null>(null);

  const query = useQuery({
    queryKey: ['day-closes', { onlyDiff }],
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
      void qc.invalidateQueries({ queryKey: ['day-closes'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDetail(null);
    },
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kunlik hisob-kitob</h1>

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

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Kun yopish yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3 text-right">Sotildi</th>
                <th className="p-3 text-right">Kutilgan naqd</th>
                <th className="p-3 text-right">Topshirdi</th>
                <th className="p-3 text-right">Kassa farqi</th>
                <th className="p-3 text-right">Tovar farqi</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  onClick={() => setDetail(d)}
                >
                  <td className="p-3">{dateShort(d.date)}</td>
                  <td className="p-3">{d.distributor_name}</td>
                  <td className="p-3 text-right">{money(d.sold_amount)}</td>
                  <td className="p-3 text-right">{money(d.cash_expected)}</td>
                  <td className="p-3 text-right">{money(d.cash_handed_amount)}</td>
                  <td
                    className={`p-3 text-right ${
                      Number(d.cash_difference) < 0 ? 'font-semibold text-danger' : ''
                    }`}
                  >
                    {money(d.cash_difference)}
                  </td>
                  <td
                    className={`p-3 text-right ${
                      Number(d.stock_difference_qty) !== 0 ? 'text-danger' : ''
                    }`}
                  >
                    {qty(d.stock_difference_qty)}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        d.status === 'CLOSED' ? 'text-success' : 'text-pending'
                      }
                    >
                      {d.status_display}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={detail !== null}
        title={detail ? `Kun yopish · ${dateShort(detail.date)}` : ''}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Row label="Tarqatuvchi" value={detail.distributor_name} />
              <Row label="Yuklangan" value={money(detail.loaded_amount)} />
              <Row label="Sotilgan" value={money(detail.sold_amount)} />
              <Row label="Qaytarilgan" value={money(detail.returned_amount)} />
              <Row label="Naqd sotuv" value={money(detail.cash_sales_amount)} />
              <Row label="Undirilgan qarz" value={money(detail.debt_collected_amount)} />
              <Row label="Qarzga berildi" value={money(detail.debt_given_amount)} />
              <Row label="Kutilgan naqd" value={money(detail.cash_expected)} />
              <Row label="Topshirilgan" value={money(detail.cash_handed_amount)} />
              <Row
                label="Kassa farqi"
                value={money(detail.cash_difference)}
                danger={Number(detail.cash_difference) < 0}
              />
              <Row
                label="Tovar farqi"
                value={`${qty(detail.stock_difference_qty)} (${money(
                  detail.stock_difference_amount,
                )})`}
                danger={Number(detail.stock_difference_qty) !== 0}
              />
              <Row label="Sotuvlar / tashriflar" value={`${detail.sales_count} / ${detail.visits_count}`} />
            </div>

            {detail.daily_returns[0]?.items.length ? (
              <div>
                <div className="mb-1 font-medium">Qaytarilgan tovarlar</div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detail.daily_returns[0].items.map((it) => (
                    <li key={it.id} className="flex justify-between py-1">
                      <span>
                        {it.product_name}{' '}
                        {it.condition !== 'GOOD' && (
                          <span className="text-danger">({it.condition})</span>
                        )}
                      </span>
                      <span>{qty(it.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {isAdmin && detail.status === 'PENDING' && (
              <button
                className="btn-brand w-full"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(detail.id)}
              >
                Tasdiqlash (kunni yopish)
              </button>
            )}
          </div>
        )}
      </Modal>
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
    <div className="flex flex-col rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-medium ${danger ? 'text-danger' : ''}`}>{value}</span>
    </div>
  );
}
