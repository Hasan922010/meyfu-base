import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import type { ReactElement } from 'react';

import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { dateShort } from '@/shared/lib/format';

const RESULT_CLASS: Record<string, string> = {
  SOTUV: 'text-success',
  SOTUVSIZ: 'text-pending',
  YOPIQ: 'text-gray-500',
};

export function MyVisitsPage(): ReactElement {
  const query = useQuery({
    queryKey: ['visits'],
    queryFn: () => clientsApi.visits({ page_size: 50, ordering: '-checked_in_at' }),
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Tashriflar</h1>
      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Hali tashrif yo‘q"
      >
        <ul className="space-y-2">
          {rows.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div>
                <div className="font-medium">{v.client_name}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {dateShort(v.checked_in_at)}
                  {v.latitude ? <MapPin size={12} aria-hidden /> : null}
                </div>
              </div>
              <span className={`text-sm font-medium ${RESULT_CLASS[v.result] ?? ''}`}>
                {v.result_display}
              </span>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}
