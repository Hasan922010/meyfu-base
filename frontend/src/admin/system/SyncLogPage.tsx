import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { listPage } from '@/shared/api/crud';
import { DataState } from '@/shared/components/DataState';
import { dateShort } from '@/shared/lib/format';

interface SyncRow {
  id: string;
  created_at: string;
  user_name: string | null;
  device_id: string;
  operations_count: number;
  conflicts_count: number;
  errors_count: number;
  duration_ms: number;
}

const PAGE_SIZE = 50;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
}

function duration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Sinxronizatsiya jurnali (v5 B6): qaysi qurilma qachon, nechta operatsiya,
 * konflikt va xato bilan sinxronlandi. Offline muammolarni topish uchun — faqat o'qish.
 */
export function SyncLogPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [problems, setProblems] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const query = useQuery({
    queryKey: ['sync-logs', { search, dateFrom, dateTo, problems, page }],
    queryFn: () =>
      listPage<SyncRow>('/sync-logs/', {
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        problems: problems ? 'true' : undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.results ?? [];
  const total = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function withReset<T>(setter: (v: T) => void): (v: T) => void {
    return (v) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Sinxronizatsiya jurnali</h1>
        <p className="text-sm text-gray-500">
          Telefonlardan serverga yuborilgan offline operatsiyalar. Konflikt yoki xato bo‘lsa —
          qator ajratib ko‘rsatiladi; batafsil holat xodimning «Sinxronizatsiya» ekranida.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-xs"
          placeholder="Xodim yoki qurilma"
          aria-label="Qidirish"
          value={search}
          onChange={(e) => withReset(setSearch)(e.target.value)}
        />
        <input
          className="field w-40"
          type="date"
          aria-label="Sanadan"
          value={dateFrom}
          onChange={(e) => withReset(setDateFrom)(e.target.value)}
        />
        <input
          className="field w-40"
          type="date"
          aria-label="Sanagacha"
          value={dateTo}
          onChange={(e) => withReset(setDateTo)(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={problems}
            onChange={(e) => withReset(setProblems)(e.target.checked)}
          />
          Faqat konflikt / xato borlari
        </label>
        <span className="text-sm text-gray-500">{total} ta yozuv</span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText={problems ? 'Muammoli sinxronizatsiya yo‘q' : 'Yozuv topilmadi'}
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Vaqt</th>
                <th className="p-3">Xodim</th>
                <th className="p-3">Qurilma</th>
                <th className="p-3 text-right">Operatsiyalar</th>
                <th className="p-3 text-right">Konflikt</th>
                <th className="p-3 text-right">Xato</th>
                <th className="p-3 text-right">Davomiyligi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hasProblem = r.conflicts_count > 0 || r.errors_count > 0;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 last:border-0 dark:border-gray-800 ${
                      hasProblem ? 'bg-pending/5' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap p-3">
                      {dateShort(r.created_at)} {timeOf(r.created_at)}
                    </td>
                    <td className="p-3">{r.user_name ?? '—'}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{r.device_id || '—'}</td>
                    <td className="p-3 text-right">{r.operations_count}</td>
                    <td
                      className={`p-3 text-right ${r.conflicts_count > 0 ? 'font-semibold text-pending' : 'text-gray-400'}`}
                    >
                      {r.conflicts_count}
                    </td>
                    <td
                      className={`p-3 text-right ${r.errors_count > 0 ? 'font-semibold text-danger' : 'text-gray-400'}`}
                    >
                      {r.errors_count}
                    </td>
                    <td className="p-3 text-right text-gray-500">{duration(r.duration_ms)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <button className="btn px-3 py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Oldingi
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          className="btn px-3 py-1"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Keyingi →
        </button>
      </div>
    </div>
  );
}
