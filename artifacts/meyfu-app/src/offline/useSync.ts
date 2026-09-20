import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { db } from './db';
import { deadCount, pendingCount } from './outbox';
import { fullSync, pushOutbox } from './sync';

export interface SyncState {
  online: boolean;
  pending: number;
  /** 20 urinishdan keyin to'xtatilgan operatsiyalar (OFF-001). */
  dead: number;
  syncing: boolean;
  lastPull: string | null;
  runSync: () => Promise<void>;
}

export function useSync(): SyncState {
  const [online, setOnline] = useState<boolean>(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
  const [syncing, setSyncing] = useState<boolean>(false);

  const pending =
    useLiveQuery(() => pendingCount(), [], 0) ?? 0;
  const dead =
    useLiveQuery(() => deadCount(), [], 0) ?? 0;
  const lastPull =
    useLiveQuery(() => db.meta.get('last_pull').then((r) => r?.value ?? null), [], null) ??
    null;

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fullSync();
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on = (): void => {
      setOnline(true);
      void pushOutbox();
    };
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const timer = window.setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine) void pushOutbox();
    }, 20_000);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.clearInterval(timer);
    };
  }, []);

  return { online, pending, dead, syncing, lastPull, runSync };
}
