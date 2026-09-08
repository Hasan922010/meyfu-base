import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { expensesApi } from '@/shared/api/finance';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-pending',
  APPROVED: 'text-success',
  REJECTED: 'text-danger',
};

export function MyExpensesPage(): ReactElement {
  const query = useQuery({
    queryKey: ['expenses', 'mine'],
    queryFn: () => expensesApi.list({ page_size: 50, ordering: '-date' }),
  });
  const summary = useQuery({
    queryKey: ['expenses', 'summary'],
    queryFn: () => expensesApi.summary(),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mening xarajatlarim</h1>
        <Link to="/m/expense/new" className="btn-brand px-3 py-1 text-sm">
          + Xarajat
        </Link>
      </div>

      {summary.data && (
        <div className="rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900">
          <div className="flex justify-between">
            <span className="text-gray-500">Jami (rad etilmagan)</span>
            <span className="font-semibold">{money(summary.data.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tasdiq kutmoqda</span>
            <span>{summary.data.pending_count}</span>
          </div>
        </div>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Hali xarajat yo'q"
      >
        <ul className="space-y-2">
          {rows.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{e.category_icon || '💸'}</span>
                <div>
                  <div className="font-medium">{e.category_name}</div>
                  <div className="text-xs text-gray-500">
                    {dateShort(e.date)}
                    {e.description && ` · ${e.description}`}
                  </div>
                  {e.status === 'REJECTED' && e.reject_reason && (
                    <div className="text-xs text-danger">Sabab: {e.reject_reason}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{money(e.amount)}</div>
                <div className={`text-xs ${STATUS_CLASS[e.status] ?? ''}`}>
                  {e.status_display}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}
