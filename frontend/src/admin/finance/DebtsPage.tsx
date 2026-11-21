import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { debtsApi, type DebtPaymentItem } from '@/shared/api/debts';
import { financeApi } from '@/shared/api/finance2';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { DataState } from '@/shared/components/DataState';
import { dateShort, dateTimeShort, money } from '@/shared/lib/format';
import { paymentLabel } from '@/shared/lib/labels';
import { useAuthStore } from '@/shared/store/authStore';

const BUCKET_LABELS: Array<{ key: keyof AgingBuckets; label: string }> = [
  { key: 'current', label: 'Muddati kelmagan' },
  { key: 'd1_30', label: '1–30 kun' },
  { key: 'd31_60', label: '31–60 kun' },
  { key: 'd61_90', label: '61–90 kun' },
  { key: 'd90_plus', label: '90+ kun' },
];

type AgingBuckets = {
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
};

function normalizeDebtSearch(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^[+\d\s()-]+$/.test(trimmed) ? trimmed.replace(/[\s()-]/g, '') : trimmed;
}

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function DebtsPage(): ReactElement {
  const qc = useQueryClient();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [payPage, setPayPage] = useState<number>(1);
  const [cancelling, setCancelling] = useState<DebtPaymentItem | null>(null);
  const searchQuery = normalizeDebtSearch(search);

  const aging = useQuery({
    queryKey: ['debt-aging'],
    queryFn: () => financeApi.debtAging(),
  });
  const list = useQuery({
    queryKey: ['debts', { status, search: searchQuery, page }],
    queryFn: () =>
      debtsApi.list({
        status: status || undefined,
        search: searchQuery || undefined,
        page,
        page_size: 25,
        ordering: 'due_date',
      }),
    placeholderData: keepPreviousData,
  });
  const payments = useQuery({
    queryKey: ['debt-payments', { search: searchQuery, payPage }],
    queryFn: () =>
      debtsApi.listPayments({
        search: searchQuery || undefined,
        page: payPage,
        page_size: 25,
        ordering: '-created_at',
      }),
    placeholderData: keepPreviousData,
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => debtsApi.cancelPayment(id),
    onSuccess: () => {
      setCancelling(null);
      void qc.invalidateQueries({ queryKey: ['debt-payments'] });
      void qc.invalidateQueries({ queryKey: ['debts'] });
      void qc.invalidateQueries({ queryKey: ['debt-aging'] });
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const rows = list.data?.results ?? [];
  const paymentRows = payments.data?.results ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Qarzdorlik</h1>

      <DataState isLoading={aging.isLoading} isError={aging.isError}>
        {aging.data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <div className="text-xs text-gray-500">Umumiy qarzdorlik</div>
                <div className="mt-1 text-lg font-bold">
                  {money(aging.data.total_outstanding)}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <div className="text-xs text-gray-500">Muddati o'tgan</div>
                <div className="mt-1 text-lg font-bold text-danger">
                  {money(aging.data.overdue_total)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
              <div className="mb-2 text-sm font-semibold">Yosh bo'yicha (aging)</div>
              <div className="flex gap-3 text-sm">
                {BUCKET_LABELS.map((b) => (
                  <div key={b.key} className="flex-1 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                    <div className="text-xs text-gray-500">{b.label}</div>
                    <div className="font-medium">
                      {money(aging.data.buckets[b.key])}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {aging.data.overdue_clients.length > 0 && (
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
                <div className="p-3 text-sm font-semibold">Muddati o'tgan mijozlar</div>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                    <tr>
                      <th className="p-3">Mijoz</th>
                      <th className="p-3">Telefon</th>
                      <th className="p-3 text-right">Summa</th>
                      <th className="p-3 text-right">Kun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.data.overdue_clients.map((c) => (
                      <tr
                        key={c.client_id ?? `${c.client}-${c.phone}`}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        <td className="p-3 font-medium">{c.client}</td>
                        <td className="p-3">{c.phone || '—'}</td>
                        <td className="p-3 text-right text-danger">{money(c.amount)}</td>
                        <td className="p-3 text-right">{c.max_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DataState>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Barcha qarzlar</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field max-w-[240px]"
              aria-label="Qarzlarni qidirish"
              placeholder="Mijoz nomi, telefon yoki sotuv…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setPayPage(1);
              }}
            />
            <select
              className="field max-w-[160px]"
              aria-label="Holat"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Hammasi</option>
              <option value="ACTIVE">Faol</option>
              <option value="PARTIAL">Qisman</option>
              <option value="OVERDUE">Muddati o'tgan</option>
              <option value="PAID">To'langan</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
          <DataState
            isLoading={list.isLoading}
            isError={list.isError}
            isEmpty={!list.isLoading && rows.length === 0}
            emptyText="Qarz yo'q"
          >
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="p-3">Mijoz</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Sotuv</th>
                  <th className="p-3 text-right">Summa</th>
                  <th className="p-3 text-right">Qoldiq</th>
                  <th className="p-3">Muddat</th>
                  <th className="p-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="p-3 font-medium">{d.client_name}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{d.client_phone || '—'}</td>
                    <td className="p-3 font-mono text-xs">{d.sale_number ?? '—'}</td>
                    <td className="p-3 text-right">{money(d.amount)}</td>
                    <td className="p-3 text-right font-medium">{money(d.remaining)}</td>
                    <td className="p-3">{d.due_date ? dateShort(d.due_date) : '—'}</td>
                    <td
                      className={`p-3 ${
                        d.status === 'OVERDUE' ? 'text-danger' : 'text-gray-500'
                      }`}
                    >
                      {d.status_display}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </div>

        {list.data && list.data.pages > 1 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button
              className="btn px-3"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            <span>
              {page} / {list.data.pages}
            </span>
            <button
              className="btn px-3"
              disabled={page >= list.data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Qarz to&apos;lovlari</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
          <DataState
            isLoading={payments.isLoading}
            isError={payments.isError}
            isEmpty={!payments.isLoading && paymentRows.length === 0}
            emptyText="Qarz to'lovi yo'q"
          >
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="p-3">Vaqt</th>
                  <th className="p-3">Mijoz</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3">Undiruvchi</th>
                  <th className="p-3">Turi</th>
                  <th className="p-3 text-right">Summa</th>
                  <th className="p-3">Izoh</th>
                  {isSuperAdmin && <th className="p-3 text-right">Amal</th>}
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((p) => {
                  const canCancel =
                    isSuperAdmin &&
                    Date.now() - new Date(p.created_at).getTime() <= CANCEL_WINDOW_MS;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        {dateTimeShort(p.created_at)}
                      </td>
                      <td className="p-3 font-medium">{p.client_name}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        {p.client_phone || '—'}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        {p.collected_by_name || '—'}
                      </td>
                      <td className="p-3">{paymentLabel(p.payment_type ?? '')}</td>
                      <td className="p-3 text-right font-medium text-emerald-700 dark:text-emerald-400">
                        {money(p.amount)}
                      </td>
                      <td className="p-3 text-gray-500">{p.note || '—'}</td>
                      {isSuperAdmin && (
                        <td className="p-3 text-right">
                          {canCancel ? (
                            <button
                              type="button"
                              onClick={() => {
                                cancelMut.reset();
                                setCancelling(p);
                              }}
                              className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10"
                            >
                              Bekor qilish
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">24 soat o&apos;tgan</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataState>
        </div>
        {payments.data && payments.data.pages > 1 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button
              className="btn px-3"
              disabled={payPage <= 1}
              onClick={() => setPayPage((p) => p - 1)}
            >
              ‹
            </button>
            <span>
              {payPage} / {payments.data.pages}
            </span>
            <button
              className="btn px-3"
              disabled={payPage >= payments.data.pages}
              onClick={() => setPayPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelling !== null}
        title="Qarz to'lovini bekor qilish"
        confirmLabel="Ha, bekor qilish"
        danger
        isPending={cancelMut.isPending}
        onConfirm={() => {
          if (cancelling) cancelMut.mutate(cancelling.id);
        }}
        onCancel={() => {
          cancelMut.reset();
          setCancelling(null);
        }}
      >
        {cancelling
          ? `${cancelling.client_name} — ${money(cancelling.amount)} to'lovini bekor qilsangiz, mijoz qarzi avvalgi holiga qaytadi.`
          : ''}
        {cancelMut.isError && (
          <p className="mt-2 text-xs font-medium text-danger" role="alert">
            {extractApiError(cancelMut.error)}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
