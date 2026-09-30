import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { MapView, type MapPoint } from '@/shared/components/map/MapView';
import { toPoint } from '@/shared/components/map/mapPoints';
import { money, timeShort } from '@/shared/lib/format';

function timeOf(iso: string): string {
  return timeShort(iso);
}

/**
 * v5 B2: tarqatuvchilar xaritasi. Faqat tashrif/sotuv paytidagi nuqta —
 * kun bo'yi kuzatuv emas (CLAUDE.md 8).
 */
export function DistributorsMap(): ReactElement | null {
  const query = useQuery({
    queryKey: ['distributor-locations'],
    queryFn: () => reportsAdvancedApi.distributorLocations(),
    refetchInterval: 60_000,
    retry: false,
  });
  const rows = query.data?.rows ?? [];
  if (query.isError || rows.length === 0) return null;

  const points = rows
    .map((r) =>
      toPoint(
        r.id,
        r.latitude,
        r.longitude,
        `${r.name} — ${r.place ?? ''}${r.at ? ` (${timeOf(r.at)})` : ''}`,
      ),
    )
    .filter((p): p is MapPoint => p !== null);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <h2 className="font-semibold">Tarqatuvchilar xaritasi (bugun)</h2>
      <p className="mb-3 text-xs text-gray-500">
        Oxirgi tashrif yoki sotuv joyi. Kun bo‘yi kuzatuv yo‘q — faqat ish paytidagi nuqtalar.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {points.length > 0 ? (
            <MapView points={points} height={320} />
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500 dark:bg-gray-800">
              Bugun hali joylashuvli tashrif yoki sotuv yo‘q
            </div>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span className={r.latitude ? '' : 'text-gray-400'}>{r.name}</span>
              <span className="text-right text-xs text-gray-500">
                {r.at ? timeOf(r.at) : '—'} · {money(r.sales_amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
