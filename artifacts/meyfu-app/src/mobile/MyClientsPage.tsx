import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';
import type { Client } from '@/shared/types/clients';

import { CheckInSheet } from './CheckInSheet';

export function MyClientsPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<Client | null>(null);

  const query = useQuery({
    queryKey: ['clients', 'mine', search],
    queryFn: () =>
      clientsApi.list({ search: search || undefined, page_size: 100 }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Mening mijozlarim</h1>
      <input
        className="field"
        placeholder="Qidirish…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Marshrutingizda mijoz yo‘q"
      >
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm active:scale-[0.99] dark:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">
                    {c.address || c.owner_name || '—'}
                  </div>
                </div>
                <div className="text-right text-xs">
                  {c.is_blocked && (
                    <div className="font-medium text-danger">Bloklangan</div>
                  )}
                  {Number(c.current_debt) > 0 && (
                    <div className="text-danger">Qarz: {money(c.current_debt)}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DataState>

      <CheckInSheet client={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
