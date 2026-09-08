import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { salesApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: 'text-success',
  FLAGGED: 'text-pending',
  CONFLICT: 'text-danger',
  CANCELLED: 'text-gray-400',
};

export function MobileAdminSales(): ReactElement {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const query = useQuery({
    queryKey: ['admin-sales-m', { status, page }],
    queryFn: () =>
      salesApi.list({
        status: status || undefined,
        page,
        page_size: 25,
        ordering: '-created_at',
      }),
    placeholderData: keepPreviousData,
  });

  const resolve = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      salesApi.resolve(id, accept),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-sales-m'] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => salesApi.cancel(id, 'Admin bekor qildi'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-sales-m'] }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Sotuvlar</h1>

      <div className="flex flex-wrap gap-1">
        {[
          { v: '', l: 'Barchasi' },
          { v: 'FLAGGED', l: 'Belgilangan' },
          { v: 'CONFLICT', l: 'Ziddiyat' },
          { v: 'CANCELLED', l: 'Bekor' },
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

      {(resolve.isError || cancel.isError) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(resolve.error ?? cancel.error)}
        </p>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Sotuv yo'q"
      >
        <ul className="space-y-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.client_name}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono">{s.number}</span> ·{' '}
                    {dateShort(s.date)} · {s.distributor_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.payment_type_display}
                    {Number(s.debt_amount) > 0 &&
                      ` · qarz ${money(s.debt_amount)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{money(s.total_amount)}</div>
                  <div className={`text-xs ${STATUS_CLASS[s.status] ?? ''}`}>
                    {s.status_display}
                  </div>
                </div>
              </div>

              {s.flagged && s.flag_reason && (
                <div className="text-xs text-pending">{s.flag_reason}</div>
              )}

              {s.status === 'CONFLICT' && (
                <div className="flex gap-2">
                  <button
                    className="btn flex-1 bg-success text-white"
                    onClick={() => resolve.mutate({ id: s.id, accept: true })}
                  >
                    Qabul
                  </button>
                  <button
                    className="btn flex-1 text-danger"
                    onClick={() => resolve.mutate({ id: s.id, accept: false })}
                  >
                    Rad
                  </button>
                </div>
              )}
              {(s.status === 'COMPLETED' || s.status === 'FLAGGED') && (
                <button
                  className="text-sm text-danger"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm(`${s.number} bekor qilinsinmi?`)) {
                      cancel.mutate(s.id);
                    }
                  }}
                >
                  Bekor qilish
                </button>
              )}
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
