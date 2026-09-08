import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { salesApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'text-gray-500',
  PARTIAL: 'text-pending',
  OVERDUE: 'text-danger',
  PAID: 'text-success',
};

export function MobileAdminDebts(): ReactElement {
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const query = useQuery({
    queryKey: ['admin-debts-m', { status, page }],
    queryFn: () =>
      salesApi.debts({
        status: status || undefined,
        page,
        page_size: 25,
        ordering: 'due_date',
      }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];
  const totalRemaining = rows.reduce((s, d) => s + Number(d.remaining), 0);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Qarzdorlik</h1>

      <div className="flex flex-wrap gap-1">
        {[
          { v: '', l: 'Barchasi' },
          { v: 'OVERDUE', l: "Muddati o'tgan" },
          { v: 'PARTIAL', l: 'Qisman' },
          { v: 'ACTIVE', l: 'Faol' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => {
              setStatus(t.v);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              status === t.v
                ? 'bg-brand text-brand-fg'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900">
          Ushbu ro'yxatda jami:{' '}
          <span className="font-bold">{money(totalRemaining)}</span>
        </div>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Qarz yo'q"
      >
        <ul className="space-y-2">
          {rows.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div>
                <div className="font-medium">{d.client_name}</div>
                <div className="text-xs text-gray-500">
                  {d.sale_number ?? '—'}
                  {d.due_date && ` · muddat ${dateShort(d.due_date)}`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{money(d.remaining)}</div>
                <div className={`text-xs ${STATUS_CLASS[d.status] ?? ''}`}>
                  {d.status_display}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DataState>

      {query.data && query.data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            className="btn px-3"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </button>
          <span>
            {page} / {query.data.pages}
          </span>
          <button
            className="btn px-3"
            disabled={page >= query.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
