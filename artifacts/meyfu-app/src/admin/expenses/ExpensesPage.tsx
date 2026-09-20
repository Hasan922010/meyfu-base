import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { expensesApi } from '@/shared/api/finance';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { Expense } from '@/shared/types/finance';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-pending',
  APPROVED: 'text-success',
  REJECTED: 'text-danger',
};

export function ExpensesPage(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [status, setStatus] = useState<string>('PENDING');
  const [page, setPage] = useState<number>(1);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [reason, setReason] = useState<string>('');

  const query = useQuery({
    queryKey: ['admin-expenses', { status, page }],
    queryFn: () =>
      expensesApi.list({
        status: status || undefined,
        page,
        page_size: 25,
        ordering: '-created_at',
      }),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ['admin-expenses', 'summary'],
    queryFn: () => expensesApi.summary(),
  });

  const approve = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-expenses'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Xarajatlar</h1>
        {summary.data && (
          <div className="text-sm text-gray-500">
            Jami: {money(summary.data.total)} · Kutmoqda: {summary.data.pending_count}
          </div>
        )}
      </div>

      {(approve.isError || reject.isError) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(approve.error ?? reject.error)}
        </p>
      )}

      <select
        className="field max-w-[200px]"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Barchasi</option>
        <option value="PENDING">Tasdiq kutmoqda</option>
        <option value="APPROVED">Tasdiqlangan</option>
        <option value="REJECTED">Rad etilgan</option>
      </select>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Xarajat yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3">Kategoriya</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Manba</th>
                <th className="p-3">Chek</th>
                <th className="p-3">Holat</th>
                {isAdmin && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">{dateShort(e.date)}</td>
                  <td className="p-3">{e.distributor_name}</td>
                  <td className="p-3">
                    {e.category_icon} {e.category_name}
                    {e.description && (
                      <span className="block text-xs text-gray-400">
                        {e.description}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-medium">{money(e.amount)}</td>
                  <td className="p-3">{e.payment_source_display}</td>
                  <td className="p-3">
                    {e.receipt_image ? (
                      <a
                        href={e.receipt_image}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        ko'rish
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`p-3 ${STATUS_CLASS[e.status] ?? ''}`}>
                    {e.status_display}
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      {e.status === 'PENDING' && (
                        <span className="flex justify-end gap-1">
                          <button
                            className="btn-brand px-2 py-1 text-xs"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(e.id)}
                          >
                            Tasdiq
                          </button>
                          <button
                            className="btn px-2 py-1 text-xs text-danger"
                            onClick={() => setRejecting(e)}
                          >
                            Rad
                          </button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      {query.data && query.data.pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
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

      <Modal
        open={rejecting !== null}
        title="Xarajatni rad etish"
        onClose={() => setRejecting(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Sabab tarqatuvchiga ko'rsatiladi (CLAUDE.md §8 — ayblovsiz).
          </p>
          <textarea
            className="field min-h-[80px] py-2"
            placeholder="Rad etish sababi"
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
