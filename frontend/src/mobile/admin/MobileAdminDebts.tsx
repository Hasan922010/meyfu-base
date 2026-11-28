import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { debtsApi } from '@/shared/api/debts';
import { financeApi } from '@/shared/api/finance2';
import { authApi } from '@/shared/api/users';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'text-gray-500',
  PARTIAL: 'text-pending',
  OVERDUE: 'text-danger',
  PAID: 'text-success',
};

function normalizeDebtSearch(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^[+\d\s()-]+$/.test(trimmed) ? trimmed.replace(/[\s()-]/g, '') : trimmed;
}

export function MobileAdminDebts(): ReactElement {
  const [staff, setStaff] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const searchQuery = normalizeDebtSearch(search);

  const staffQuery = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => authApi.staff(),
  });
  const staffOptions = (staffQuery.data ?? []).filter((u) =>
    ['DISTRIBUTOR', 'ORDER_TAKER', 'WAREHOUSE', 'BRANCH_MANAGER'].includes(u.role),
  );

  const aging = useQuery({
    queryKey: ['debt-aging', { staff }],
    queryFn: () => financeApi.debtAging(staff ? { staff } : undefined),
  });

  const query = useQuery({
    queryKey: ['admin-debts-m', 'by-client', { staff, status, search: searchQuery, page }],
    queryFn: () =>
      debtsApi.byClient({
        staff: staff || undefined,
        status: status || undefined,
        search: searchQuery || undefined,
        page,
        page_size: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];
  const totalRemaining = rows.reduce((s, d) => s + Number(d.remaining), 0);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Qarzdorlik</h1>

      <select
        className="field"
        aria-label="Xodim mijozlari"
        value={staff}
        onChange={(e) => {
          setStaff(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Barcha xodimlar</option>
        {staffOptions.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </select>

      <input
        className="field"
        aria-label="Qarzdor qidirish"
        placeholder="Mijoz nomi yoki telefon…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

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

      {(aging.data || rows.length > 0) && (
        <div className="rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900">
          <div>
            Jami qarzdorlik:{' '}
            <span className="font-bold">
              {money(aging.data ? aging.data.total_outstanding : totalRemaining)}
            </span>
          </div>
          {aging.data && Number(aging.data.overdue_total) > 0 && (
            <div className="mt-0.5 text-xs text-danger">
              Muddati o&apos;tgan: {money(aging.data.overdue_total)}
            </div>
          )}
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
              key={d.client}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div>
                <div className="font-medium">{d.client_name}</div>
                {d.client_phone && (
                  <div className="text-xs text-gray-500">{d.client_phone}</div>
                )}
                <div className="text-xs text-gray-500">
                  {d.debt_count > 1 ? `${d.debt_count} ta yozuv` : 'Jami qarz'}
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
