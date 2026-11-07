import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { DataState } from '@/shared/components/DataState';
import { MapView, type MapPoint } from '@/shared/components/map/MapView';
import { toPoint } from '@/shared/components/map/mapPoints';

/**
 * v5 C4: marshrut tartibini optimallashtirish — eng yaqin qo'shni + 2-opt.
 * Avval taklif ko'rsatiladi, "Saqlash" bosilgandagina yoziladi.
 */
export function RouteOptimizer({
  routeId,
  onDone,
}: {
  routeId: string;
  onDone: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [saved, setSaved] = useState<boolean>(false);
  const query = useQuery({
    queryKey: ['route-optimize', routeId],
    queryFn: () => clientsApi.optimizeRoute(routeId),
  });
  const save = useMutation({
    mutationFn: () =>
      clientsApi.reorderRoute(
        routeId,
        (query.data?.clients ?? []).map((c) => c.id),
      ),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const data = query.data;
  const savedKm = data ? Math.max(0, data.km_before - data.km_after) : 0;

  return (
    <div className="space-y-4 text-sm">
      <DataState isLoading={query.isLoading} isError={query.isError} error={query.error}>
        {data && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                <div className="text-xs text-gray-500">Hozirgi tartib</div>
                <div className="font-semibold">{data.km_before} km</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                <div className="text-xs text-gray-500">Taklif</div>
                <div className="font-semibold text-success">{data.km_after} km</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                <div className="text-xs text-gray-500">Tejash</div>
                <div className="font-semibold">{savedKm.toFixed(2)} km</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Masofa to‘g‘ri chiziq bo‘yicha taxminiy hisoblangan.
              {data.without_location > 0 &&
                ` Joylashuvi yo‘q ${data.without_location} ta mijoz oxirida qoldi.`}
            </p>
            <MapView
              points={data.clients
                .map((c) => toPoint(c.id, c.latitude, c.longitude, c.name))
                .filter((p): p is MapPoint => p !== null)}
              connect
              numbered
              height={260}
            />
            <ol className="max-h-72 space-y-1 overflow-y-auto">
              {data.clients.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-2 rounded-lg border border-gray-100 p-2 dark:border-gray-800"
                >
                  <span className="w-6 text-right font-mono text-gray-400">{c.order}.</span>
                  <span>
                    {c.name}
                    {c.address && <span className="block text-xs text-gray-500">{c.address}</span>}
                  </span>
                  {c.latitude == null && (
                    <span className="ml-auto text-xs text-pending">joylashuv yo‘q</span>
                  )}
                </li>
              ))}
            </ol>
            {save.isError && <p className="text-danger">{extractApiError(save.error)}</p>}
            {saved ? (
              <div className="flex items-center justify-between">
                <span className="text-success">Tartib saqlandi.</span>
                <button className="btn px-4" onClick={onDone}>
                  Yopish
                </button>
              </div>
            ) : (
              <button
                className="btn-brand w-full"
                disabled={save.isPending || data.clients.length === 0}
                onClick={() => save.mutate()}
              >
                Shu tartibni saqlash
              </button>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
