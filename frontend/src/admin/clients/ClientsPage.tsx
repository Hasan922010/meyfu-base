import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { Client } from '@/shared/types/clients';

import { ClientForm } from './ClientForm';

export function ClientsPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [search, setSearch] = useState<string>('');
  const [blocked, setBlocked] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState<number>(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => clientsApi.routes({ page_size: 200 }),
  });

  const [route, setRoute] = useState<string>('');

  const query = useQuery({
    queryKey: ['clients', { search, blocked, route, page }],
    queryFn: () =>
      clientsApi.list({
        search: search || undefined,
        is_blocked: blocked || undefined,
        route: route || undefined,
        page,
        page_size: 20,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.results ?? [];

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

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          placeholder="Nomi / egasi / telefon / INN"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="field max-w-[180px]"
          value={route}
          onChange={(e) => {
            setRoute(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Barcha marshrutlar</option>
          {routes.data?.results.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className="field max-w-[160px]"
          value={blocked}
          onChange={(e) => {
            setBlocked(e.target.value as '' | 'true' | 'false');
            setPage(1);
          }}
        >
          <option value="">Hammasi</option>
          <option value="false">Faol</option>
          <option value="true">Bloklangan</option>
        </select>
      </div>

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
                <th className="p-3">Do'kon</th>
                <th className="p-3">Egasi</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Marshrut</th>
                <th className="p-3 text-right">Qarz / limit</th>
                <th className="p-3">Holat</th>
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
                      <button
                        className="text-brand hover:underline"
                        onClick={() => setEditing(c)}
                      >
                        Tahrirlash
                      </button>
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
