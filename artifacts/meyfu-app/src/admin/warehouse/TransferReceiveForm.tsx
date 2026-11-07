import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { qty } from '@/shared/lib/format';
import type { Transfer } from '@/shared/types/warehouse';

/** Kelgan tovarni sanab qabul qilish. Farq bo'lsa izoh so'raladi (ayblovsiz). */
export function TransferReceiveForm({
  transfer,
  onDone,
}: {
  transfer: Transfer;
  onDone: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, string>>(() =>
    Object.fromEntries(transfer.items.map((i) => [i.id, i.quantity])),
  );
  const [note, setNote] = useState<string>('');

  // "1,5" ham qabul qilinadi; son bo'lmagan qiymat — bo'sh hisoblanadi (FE-112)
  const valueOf = (id: string): number => Number((received[id] ?? '').replace(',', '.'));
  const tooMuch = transfer.items.some((i) => valueOf(i.id) > Number(i.quantity));
  const empty = transfer.items.some(
    (i) => received[i.id]?.trim() === '' || !Number.isFinite(valueOf(i.id)) || valueOf(i.id) < 0,
  );
  const hasDifference = transfer.items.some(
    (i) => valueOf(i.id) !== Number(i.quantity),
  );
  const invalid = tooMuch || empty || (hasDifference && !note.trim());

  const mutation = useMutation({
    mutationFn: () =>
      warehouseApi.receiveTransfer(transfer.id, {
        items: transfer.items.map((i) => ({
          id: i.id,
          received_quantity: (received[i.id] ?? i.quantity).replace(',', '.'),
        })),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['branches'] });
      onDone();
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {transfer.from_warehouse_name} → {transfer.to_warehouse_name}. Haqiqatda kelgan
        miqdorni kiriting.
      </p>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {transfer.items.map((i) => {
          const over = Number(received[i.id]) > Number(i.quantity);
          return (
            <li key={i.id} className="flex items-center gap-2 p-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{i.product_name}</div>
                <div className={`text-xs ${over ? 'text-danger' : 'text-gray-500'}`}>
                  Jo'natilgan: {qty(i.quantity)} {i.product_unit}
                </div>
              </div>
              <input
                className="field w-28 text-right"
                inputMode="decimal"
                aria-label={`${i.product_name} — qabul qilingan miqdor`}
                value={received[i.id] ?? ''}
                onChange={(e) => setReceived((prev) => ({ ...prev, [i.id]: e.target.value }))}
              />
            </li>
          );
        })}
      </ul>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Izoh {hasDifference ? '* (farq bor — sababini yozing)' : '(ixtiyoriy)'}
        </span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {tooMuch && (
        <p className="text-sm text-danger">Jo'natilganidan ko'p qabul qilib bo'lmaydi.</p>
      )}
      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn px-4" onClick={onDone}>
          Bekor
        </button>
        <button
          type="button"
          className="btn-brand px-6"
          disabled={invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Qabul qilish
        </button>
      </div>
    </div>
  );
}
