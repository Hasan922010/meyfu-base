import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import { SortableTh } from '@/shared/table/SortableTh';
import { TableToolbar, type TableFilter } from '@/shared/table/TableToolbar';
import { useServerTable } from '@/shared/table/useServerTable';
import type { Client } from '@/shared/types/clients';

import { ClientForm } from './ClientForm';

export function ClientsPage(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [deleting, setDeleting] = useState<Client | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Saralash/qidiruv/filtr serverda — barcha mijozlar ustida
  const table = useServerTable({ initialSort: { key: 'name', dir: 'asc' } });
  const { page, setPage } = table;
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => clientsApi.routes({ page_size: 200 }),
  });

  const query = useQuery({
    queryKey: ['clients', table.params],
    queryFn: () => clientsApi.list({ ...table.params, page_size: 20 }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];
  const th = { sort: table.sort, onSort: table.onSort };
  const filters: TableFilter[] = [
    {
      key: 'route',
      label: 'Marshrut',
      options: (routes.data?.results ?? []).map((r) => ({ value: r.id, label: r.name })),
    },
    {
      key: 'is_blocked',
      label: 'Holat',
      options: [
        { value: 'false', label: 'Faol' },
        { value: 'true', label: 'Bloklangan' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mijozlar</h1>
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Mijoz
          </button>
        )}
      </div>

      <TableToolbar
        search={table.search}
        onSearch={table.setSearch}
        filters={filters}
        values={table.filterValues}
        onFilter={table.setFilter}
        onReset={table.reset}
        count={query.data?.count}
      />

      {del.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(del.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Mijoz topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <SortableTh sortKey="name" {...th}>Do'kon</SortableTh>
                <SortableTh sortKey="owner_name" {...th}>Egasi</SortableTh>
                <SortableTh sortKey="phone" {...th}>Telefon</SortableTh>
                <SortableTh sortKey="route__name" {...th}>Marshrut</SortableTh>
                <SortableTh sortKey="current_debt" align="right" className="p-3 text-right" {...th}>
                  Qarz / limit
                </SortableTh>
                <SortableTh sortKey="is_blocked" {...th}>Holat</SortableTh>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.owner_name || '—'}</td>
                  <td className="p-3">{c.phone || '—'}</td>
                  <td className="p-3">{c.route_name ?? '—'}</td>
                  <td className="p-3 text-right">
                    <span className={Number(c.current_debt) > 0 ? 'text-danger' : ''}>
                      {money(c.current_debt)}
                    </span>
                    <span className="text-gray-400"> / {money(c.debt_limit)}</span>
                  </td>
                  <td className="p-3">
                    {c.is_blocked ? (
                      <span className="text-danger">Bloklangan</span>
                    ) : (
                      <span className="text-success">Faol</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      <span className="flex justify-end gap-3">
                        <button
                          className="text-brand hover:underline"
                          onClick={() => setEditing(c)}
                        >
                          Tahrirlash
                        </button>
                        <button
                          className="text-danger hover:underline"
                          disabled={del.isPending}
                          onClick={() => setDeleting(c)}
                        >
                          O'chirish
                        </button>
                      </span>
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
            onClick={() => setPage(page - 1)}
          >
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

      <ConfirmDialog
        open={deleting !== null}
        title="Mijozni o'chirish"
        confirmLabel="O'chirish"
        danger
        isPending={del.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      >
        «{deleting?.name}» mijozi ro'yxatdan o'chiriladi. Sotuv va qarz tarixi saqlanib qoladi.
      </ConfirmDialog>

      <Modal
        open={creating || editing !== null}
        title={editing ? 'Mijozni tahrirlash' : 'Yangi mijoz'}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <ClientForm
          client={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}
