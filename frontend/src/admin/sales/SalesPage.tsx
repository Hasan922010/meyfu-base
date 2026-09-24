import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type { ReactElement } from 'react';

import { reportsApi, salesApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import { SortableTh } from '@/shared/table/SortableTh';
import { TableToolbar, type TableFilter } from '@/shared/table/TableToolbar';
import { useServerTable } from '@/shared/table/useServerTable';

const STATUS_CLASS: Record<string, string> = {
  COMPLETED: 'text-success',
  FLAGGED: 'text-pending',
  CONFLICT: 'text-danger',
  CANCELLED: 'text-gray-400',
};

const FILTERS: TableFilter[] = [
  {
    key: 'status',
    label: 'Holat',
    options: [
      { value: 'COMPLETED', label: 'Yakunlangan' },
      { value: 'FLAGGED', label: 'Belgilangan' },
      { value: 'CONFLICT', label: 'Ziddiyat' },
      { value: 'CANCELLED', label: 'Bekor qilingan' },
    ],
  },
  {
    key: 'payment_type',
    label: "To'lov",
    options: [
      { value: 'NAQD', label: 'Naqd' },
      { value: 'PLASTIK', label: 'Plastik' },
      { value: 'QARZ', label: 'Qarzga' },
      { value: 'ARALASH', label: 'Aralash' },
    ],
  },
  { key: 'date__gte', label: 'Sanadan', type: 'date' },
  { key: 'date__lte', label: 'Sanagacha', type: 'date' },
];

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

  // Saralash/qidiruv/filtr serverda — barcha sotuvlar ustida, faqat joriy sahifada emas
  const table = useServerTable({ initialSort: { key: 'date', dir: 'desc' } });
  const { page, setPage } = table;

  const query = useQuery({
    queryKey: ['admin-sales', table.params],
    queryFn: () =>
      salesApi.list({ ...table.params, page_size: 25, ordering: table.params.ordering ?? '-created_at' }),
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
  const th = { sort: table.sort, onSort: table.onSort };

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

      <TableToolbar
        search={table.search}
        onSearch={table.setSearch}
        filters={FILTERS}
        values={table.filterValues}
        onFilter={table.setFilter}
        onReset={table.reset}
        count={query.data?.count}
      />

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Sotuv topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <SortableTh sortKey="number" {...th}>Raqam</SortableTh>
                <SortableTh sortKey="date" {...th}>Sana</SortableTh>
                <SortableTh sortKey="client__name" {...th}>Mijoz</SortableTh>
                <SortableTh sortKey="distributor__full_name" {...th}>Tarqatuvchi</SortableTh>
                <SortableTh sortKey="payment_type" {...th}>To'lov</SortableTh>
                <SortableTh sortKey="total_amount" align="right" className="p-3 text-right" {...th}>
                  Jami
                </SortableTh>
                <SortableTh sortKey="debt_amount" align="right" className="p-3 text-right" {...th}>
                  Qarz
                </SortableTh>
                <SortableTh sortKey="status" {...th}>Holat</SortableTh>
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
          <button className="btn px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ‹
          </button>
          <span>
            {page} / {query.data.pages}
          </span>
          <button
            className="btn px-3"
            disabled={page >= query.data.pages}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
