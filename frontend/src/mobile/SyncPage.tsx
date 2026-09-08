import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { db } from '@/offline/db';
import { retryFailed } from '@/offline/outbox';
import { useSync } from '@/offline/useSync';
import { dateShort } from '@/shared/lib/format';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Navbatda',
  SENDING: 'Yuborilmoqda',
  FAILED: 'Xato',
  CONFLICT: 'Ziddiyat',
  SENT: 'Yuborildi',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-gray-500',
  SENDING: 'text-brand',
  FAILED: 'text-danger',
  CONFLICT: 'text-danger',
};

export function SyncPage(): ReactElement {
  const sync = useSync();
  const ops = useLiveQuery(() => db.outbox.orderBy('created_at').toArray(), [], []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Sinxronizatsiya</h1>

      <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
        <div className="flex justify-between">
          <span className="text-gray-500">Holat</span>
          <span className="inline-flex items-center gap-1.5">
            {sync.online ? (
              <>
                <Wifi size={14} className="text-success" aria-hidden /> Online
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-danger" aria-hidden /> Offline
              </>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Navbatda</span>
          <span>{sync.pending}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Oxirgi yangilanish</span>
          <span>{sync.lastPull ? dateShort(sync.lastPull) : '—'}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-brand flex flex-1 items-center justify-center gap-1.5"
          disabled={sync.syncing || !sync.online}
          onClick={() => void sync.runSync()}
        >
          <RefreshCw size={15} className={sync.syncing ? 'animate-spin' : ''} aria-hidden />
          {sync.syncing ? 'Sinxronlanmoqda…' : 'Hozir sinxronlash'}
        </button>
        <button
          className="btn flex flex-1 items-center justify-center gap-1.5"
          onClick={() => void retryFailed()}
        >
          <RotateCcw size={15} aria-hidden /> Xatolarni qayta urinish
        </button>
      </div>

      <ul className="space-y-2">
        {ops.map((op) => (
          <li
            key={op.client_uuid}
            className="rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
          >
            <div className="flex justify-between">
              <span className="font-medium">{op.summary}</span>
              <span className={STATUS_CLASS[op.status] ?? ''}>
                {STATUS_LABEL[op.status] ?? op.status}
              </span>
            </div>
            {op.error && <div className="mt-1 text-xs text-danger">{op.error}</div>}
            {op.attempts > 0 && (
              <div className="text-xs text-gray-400">Urinishlar: {op.attempts}</div>
            )}
          </li>
        ))}
        {ops.length === 0 && (
          <li className="py-8 text-center text-gray-400">Navbat bo'sh</li>
        )}
      </ul>
    </div>
  );
}
