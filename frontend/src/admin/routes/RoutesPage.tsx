import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { authApi } from '@/shared/api/users';
import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';
import type { Route } from '@/shared/types/clients';

const WEEKDAYS: Array<{ n: number; label: string }> = [
  { n: 1, label: 'Du' },
  { n: 2, label: 'Se' },
  { n: 3, label: 'Ch' },
  { n: 4, label: 'Pa' },
  { n: 5, label: 'Ju' },
  { n: 6, label: 'Sh' },
  { n: 7, label: 'Ya' },
];

function RouteForm({
  route,
  onDone,
}: {
  route: Route | null;
  onDone: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [name, setName] = useState<string>(route?.name ?? '');
  const [distributor, setDistributor] = useState<string>(route?.distributor ?? '');
  const [days, setDays] = useState<number[]>(route?.days_of_week ?? []);

  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: () => authApi.distributors(),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name,
        days_of_week: [...days].sort((a, b) => a - b),
        distributor: distributor || null,
      };
      return route
        ? clientsApi.updateRoute(route.id, body)
        : clientsApi.createRoute(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['routes'] });
      onDone();
    },
  });

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Nomi *</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tarqatuvchi</span>
        <select
          className="field"
          value={distributor}
          onChange={(e) => setDistributor(e.target.value)}
        >
          <option value="">—</option>
          {distributors.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-1">
        <span className="text-sm font-medium">Hafta kunlari</span>
        <div className="flex gap-1">
          {WEEKDAYS.map((w) => {
            const active = days.includes(w.n);
            return (
              <button
                key={w.n}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    active ? prev.filter((d) => d !== w.n) : [...prev, w.n],
                  )
                }
                className={`h-10 w-10 rounded-lg text-sm font-medium ${
                  active
                    ? 'bg-brand text-brand-fg'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn px-4">
          Bekor
        </button>
        <button
          type="button"
          className="btn-brand px-6"
          disabled={!name || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Saqlash
        </button>
      </div>
    </div>
  );
}

export function RoutesPage(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [editing, setEditing] = useState<Route | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['routes'],
    queryFn: () => clientsApi.routes({ page_size: 100 }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marshrutlar</h1>
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Marshrut
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Marshrut yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Nomi</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3">Kunlar</th>
                <th className="p-3 text-right">Mijozlar</th>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{r.distributor_name ?? '—'}</td>
                  <td className="p-3">{r.days_display.join(', ') || '—'}</td>
                  <td className="p-3 text-right">{r.clients_count}</td>
                  {canWrite && (
                    <td className="p-3 text-right">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => setEditing(r)}
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

      <Modal
        open={creating || editing !== null}
        title={editing ? 'Marshrutni tahrirlash' : 'Yangi marshrut'}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <RouteForm
          route={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}
