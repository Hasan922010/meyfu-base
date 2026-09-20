import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { expensesApi } from '@/shared/api/finance';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import type { Expense } from '@/shared/types/finance';

export function MobileAdminExpenses(): ReactElement {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('PENDING');
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [reason, setReason] = useState<string>('');

  const query = useQuery({
    queryKey: ['admin-expenses', { status, page: 1 }],
    queryFn: () =>
      expensesApi.list({
        status: status || undefined,
        page_size: 50,
        ordering: '-created_at',
      }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-expenses'] });
      void qc.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
  });
  const reject = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => expensesApi.reject(id, r),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-expenses'] });
      setRejecting(null);
      setReason('');
    },
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Xarajatlar</h1>

      <div className="flex gap-1">
        {[
          { v: 'PENDING', l: 'Kutmoqda' },
          { v: 'APPROVED', l: 'Tasdiqlangan' },
          { v: 'REJECTED', l: 'Rad etilgan' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setStatus(t.v)}
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

      {(approve.isError || reject.isError) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(approve.error ?? reject.error)}
        </p>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Xarajat yo'q"
      >
        <ul className="space-y-2">
          {rows.map((e) => (
            <li
              key={e.id}
              className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {e.category_icon} {e.category_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {e.distributor_name} · {dateShort(e.date)} ·{' '}
                    {e.payment_source_display}
                  </div>
                  {e.description && (
                    <div className="text-xs text-gray-400">{e.description}</div>
                  )}
                </div>
                <div className="text-right text-lg font-bold">
                  {money(e.amount)}
                </div>
              </div>

              {e.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button
                    className="btn flex-1 bg-success text-white"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(e.id)}
                  >
                    ✅ Tasdiqlash
                  </button>
                  <button
                    className="btn flex-1 text-danger"
                    onClick={() => setRejecting(e)}
                  >
                    ❌ Rad etish
                  </button>
                </div>
              ) : (
                <div
                  className={`text-sm ${
                    e.status === 'APPROVED' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {e.status_display}
                  {e.reject_reason && ` · ${e.reject_reason}`}
                </div>
              )}
            </li>
          ))}
        </ul>
      </DataState>

      <Modal
        open={rejecting !== null}
        title="Rad etish sababi"
        onClose={() => setRejecting(null)}
      >
        <div className="space-y-3">
          <textarea
            className="field min-h-[80px]"
            placeholder="Nega rad etilmoqda?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="btn-brand w-full"
            disabled={!reason.trim() || reject.isPending}
            onClick={() =>
              rejecting && reject.mutate({ id: rejecting.id, r: reason.trim() })
            }
          >
            Rad etish
          </button>
        </div>
      </Modal>
    </div>
  );
}
