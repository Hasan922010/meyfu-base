import type { ReactElement } from 'react';

import { useEventStream } from './useEventStream';

/** Autentifikatsiya qilingan qism ichida render qilinadi — WS ni ushlab turadi. */
export function RealtimeBridge(): ReactElement | null {
  useEventStream();
  return null;
}
