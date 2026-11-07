import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { MapView, type MapPoint } from '@/shared/components/map/MapView';
import { toPoint } from '@/shared/components/map/mapPoints';
import { money } from '@/shared/lib/format';

const DEBT_COLOR = '#dc2626';
const BLOCKED_COLOR = '#6b7280';

/** v5 B2: mijozlar xaritada — qarzdorlar qizil, bloklanganlar kulrang. */
export function ClientsMap({ search }: { search: string }): ReactElement {
  const query = useQuery({
    queryKey: ['clients', 'map', search],
    queryFn: () => clientsApi.list({ search: search || undefined, page_size: 500 }),
  });
  const rows = query.data?.results ?? [];
  const points = rows
    .map((c) => {
      const debt = Number(c.current_debt);
      const color = c.is_blocked ? BLOCKED_COLOR : debt > 0 ? DEBT_COLOR : undefined;
      const label = debt > 0 ? `${c.name} — qarz ${money(debt)}` : c.name;
      return toPoint(c.id, c.latitude, c.longitude, label, color);
    })
    .filter((p): p is MapPoint => p !== null);

  return (
    <DataState isLoading={query.isLoading} isError={query.isError} error={query.error}>
      <div className="space-y-2">
        <MapView points={points} height={480} />
        <p className="text-xs text-gray-500">
          Xaritada {points.length} ta mijoz. Joylashuvi yo‘q: {rows.length - points.length} ta.
          Qizil — qarzdor, kulrang — bloklangan.
        </p>
      </div>
    </DataState>
  );
}
