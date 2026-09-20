import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, RotateCcw, Trash2, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import type { ReactElement } from 'react';

import { db } from '@/offline/db';
import { deleteOp, retryFailed } from '@/offline/outbox';
import { useSync } from '@/offline/useSync';
import { dateShort } from '@/shared/lib/format';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Navbatda',
  SENDING: 'Yuborilmoqda',
  FAILED: 'Xato',
  CONFLICT: 'Ziddiyat',
  SENT: 'Yuborildi',
  DEAD: 'Yuborilmadi (20 urinish)',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-gray-500',
  SENDING: 'text-brand',
  FAILED: 'text-danger',
  CONFLICT: 'text-danger',
  DEAD: 'font-semibold text-danger',
};

export function SyncPage(): ReactElement {
  const sync = useSync();
  const ops = useLiveQuery(() => db.outbox.orderBy('created_at').toArray(), [], []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Sinxronizatsiya</h1>

      {sync.dead > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <span>
            {sync.dead} ta operatsiya 20 marta urinishdan keyin yuborilmadi. Quyida
            «Qayta urinish» yoki har birini alohida o'chiring; muammo takrorlansa
            adminga xabar bering.
          </span>
        </div>
      )}

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
            {op.status === 'DEAD' && (
              <button
                className="mt-2 inline-flex items-center gap-1 text-xs text-danger"
                onClick={() => void deleteOp(op.client_uuid)}
              >
                <Trash2 size={13} aria-hidden /> Navbatdan o'chirish
              </button>
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
