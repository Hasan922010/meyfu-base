import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { db } from './db';
import { pendingCount } from './outbox';
import { fullSync, pushOutbox } from './sync';

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastPull: string | null;
  runSync: () => Promise<void>;
}

export function useSync(): SyncState {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);

  const pending =
    useLiveQuery(() => pendingCount(), [], 0) ?? 0;
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
    const on = (): void => {
      setOnline(true);
      void pushOutbox();
    };
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    const timer = window.setInterval(() => {
      if (navigator.onLine) void pushOutbox();
    }, 20_000);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.clearInterval(timer);
    };
  }, []);

  return { online, pending, syncing, lastPull, runSync };
}
