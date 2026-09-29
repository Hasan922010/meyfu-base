import { lazy, Suspense, type ReactElement } from 'react';

import type { LeafletMapProps } from './LeafletMap';

export type { MapPoint } from './LeafletMap';

const LeafletMap = lazy(() => import('./LeafletMap'));

/** Xarita — leaflet faqat kerak bo'lganda yuklanadi (v5 B2). */
export function MapView(props: LeafletMapProps): ReactElement {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? 360 }}
          className="flex w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 dark:bg-gray-800"
        >
          Xarita yuklanmoqda…
        </div>
      }
    >
      <LeafletMap {...props} />
    </Suspense>
  );
}
