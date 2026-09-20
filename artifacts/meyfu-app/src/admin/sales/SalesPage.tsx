import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { reportsApi, salesApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: 'text-success',
  FLAGGED: 'text-pending',
  CONFLICT: 'text-danger',
  CANCELLED: 'text-gray-400',
};

async function downloadExport(): Promise<void> {
  const blob = await reportsApi.exportBlob({ type: 'sales' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sotuvlar.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export function SalesPage(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const query = useQuery({
    queryKey: ['admin-sales', { status, search, page }],
    queryFn: () =>
      salesApi.list({
        status: status || undefined,
        search: search || undefined,
        page,
        page_size: 25,
        ordering: '-created_at',
      }),
    placeholderData: keepPreviousData,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => salesApi.cancel(id, 'Admin bekor qildi'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-sales'] }),
  });
  const resolve = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      salesApi.resolve(id, accept),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-sales'] }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sotuvlar</h1>
        <button
          className="btn flex items-center gap-1.5 px-4"
          onClick={() => void downloadExport()}
        >
          <Download size={16} aria-hidden /> Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          placeholder="Raqam / mijoz"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="field max-w-[180px]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Barcha holatlar</option>
          <option value="COMPLETED">Yakunlangan</option>
          <option value="FLAGGED">Belgilangan</option>
          <option value="CONFLICT">Ziddiyat</option>
          <option value="CANCELLED">Bekor qilingan</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Sotuv topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Sana</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3">To'lov</th>
                <th className="p-3 text-right">Jami</th>
                <th className="p-3 text-right">Qarz</th>
                <th className="p-3">Holat</th>
                {isAdmin && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-mono text-xs">{s.number}</td>
                  <td className="p-3">{dateShort(s.date)}</td>
                  <td className="p-3">{s.client_name}</td>
                  <td className="p-3">{s.distributor_name}</td>
                  <td className="p-3">{s.payment_type_display}</td>
                  <td className="p-3 text-right">{money(s.total_amount)}</td>
                  <td className="p-3 text-right">
                    {Number(s.debt_amount) > 0 ? money(s.debt_amount) : '—'}
                  </td>
                  <td className={`p-3 ${STATUS_CLASS[s.status] ?? ''}`}>
                    {s.status_display}
                    {s.flagged && (
                      <span className="block text-xs text-pending">{s.flag_reason}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      {s.status === 'CONFLICT' && (
                        <span className="flex justify-end gap-1">
                          <button
                            className="btn-brand px-2 py-1 text-xs"
                            onClick={() => resolve.mutate({ id: s.id, accept: true })}
                          >
                            Qabul
                          </button>
                          <button
                            className="btn px-2 py-1 text-xs text-danger"
                            onClick={() => resolve.mutate({ id: s.id, accept: false })}
                          >
                            Rad
                          </button>
                        </span>
                      )}
                      {(s.status === 'COMPLETED' || s.status === 'FLAGGED') && (
                        <button
                          className="text-danger hover:underline"
                          disabled={cancel.isPending}
                          onClick={() => cancel.mutate(s.id)}
                        >
                          Bekor qilish
                        </button>
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
    </div>
  );
}
