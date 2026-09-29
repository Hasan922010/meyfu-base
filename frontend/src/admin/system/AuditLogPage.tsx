import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useState, type ReactElement } from 'react';

import { listPage } from '@/shared/api/crud';
import { DataState } from '@/shared/components/DataState';
import { dateShort } from '@/shared/lib/format';

interface AuditRow {
  id: string;
  created_at: string;
  user_name: string | null;
  action: string;
  model_name: string;
  object_id: string;
  changes: Record<string, unknown>;
  ip: string | null;
}

const PAGE_SIZE = 50;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
}

/** Audit jurnali (CLAUDE.md 5.3): kim, qachon, nimani o'zgartirdi. Faqat o'qish. */
export function AuditLogPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [open, setOpen] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['audit-logs', { search, dateFrom, dateTo, page }],
    queryFn: () =>
      listPage<AuditRow>('/audit-logs/', {
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.results ?? [];
  const total = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function withReset(setter: (v: string) => void): (v: string) => void {
    return (v) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit jurnali</h1>
        <p className="text-sm text-gray-500">
          Narx o'zgarishi, kun yopilgandan keyingi tahrir, tasdiqlash, bloklash va boshqa
          muhim amallar. Yozuvlar o'chirilmaydi. Qatorni bosib, o'zgarishni ko'ring.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          placeholder="Amal, model, xodim"
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
        <span className="self-center text-sm text-gray-500">{total} ta yozuv</span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Yozuv topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Vaqt</th>
                <th className="p-3">Xodim</th>
                <th className="p-3">Amal</th>
                <th className="p-3">Obyekt</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    <td className="whitespace-nowrap p-3">
                      {dateShort(r.created_at)} {timeOf(r.created_at)}
                    </td>
                    <td className="p-3">{r.user_name ?? 'Tizim'}</td>
                    <td className="p-3 font-mono text-xs">{r.action}</td>
                    <td className="p-3 text-gray-500">
                      {r.model_name} {r.object_id ? `#${r.object_id.slice(0, 8)}` : ''}
                    </td>
                    <td className="p-3 text-gray-400">{r.ip ?? '—'}</td>
                  </tr>
                  {open === r.id && (
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td colSpan={5} className="bg-gray-50 p-3 dark:bg-gray-800/50">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                          {JSON.stringify(r.changes, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
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
