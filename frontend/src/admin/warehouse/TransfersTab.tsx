import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { DocumentModal } from '@/admin/documents/DocumentModal';
import type { ActivityDocument } from '@/shared/api/branches';
import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { Transfer } from '@/shared/types/warehouse';

import { TransferForm } from './TransferForm';
import { TransferReceiveForm } from './TransferReceiveForm';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-gray-500',
  SENT: 'text-pending',
  RECEIVED: 'text-success',
  CANCELLED: 'text-gray-400 line-through',
};

type Pending = { kind: 'send' | 'cancel'; transfer: Transfer };

/** Ombor/filiallar orasida tovar ko'chirish: qoralama → yo'lda → qabul qilindi. */
export function TransfersTab(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'WAREHOUSE' || role === 'MANAGER' || role === 'BRANCH_MANAGER' ||
    role === 'SUPER_ADMIN';

  const [creating, setCreating] = useState<boolean>(false);
  const [receiving, setReceiving] = useState<Transfer | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [doc, setDoc] = useState<ActivityDocument | null>(null);

  const query = useQuery({
    queryKey: ['transfers'],
    queryFn: () => warehouseApi.transfers({ page_size: 50 }),
  });

  const action = useMutation({
    mutationFn: ({ kind, transfer }: Pending) =>
      kind === 'send'
        ? warehouseApi.sendTransfer(transfer.id)
        : warehouseApi.cancelTransfer(transfer.id),
    onSuccess: () => {
      setPending(null);
      void qc.invalidateQueries({ queryKey: ['transfers'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  const rows = query.data?.results ?? [];

  function openDocument(t: Transfer): void {
    setDoc({ type: 'transfer', id: t.id, label: "Ko'chirish", number: t.number });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Tovar jo'natilganda manba ombordan chiqadi va «yo'lda» bo'ladi. Qabul qiluvchi
          filial tasdiqlagach, uning qoldig'iga qo'shiladi.
        </p>
        {canWrite && (
          <button className="btn-brand shrink-0 px-4" onClick={() => setCreating(true)}>
            + Ko'chirish
          </button>
        )}
      </div>

      {action.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(action.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Hali ko'chirish yo'q — «+ Ko'chirish» bilan filialga tovar jo'nating"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Qayerdan → Qayerga</th>
                <th className="p-3">Sana</th>
                <th className="p-3 text-right">Tovarlar</th>
                <th className="p-3">Holat</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-mono text-xs">
                    <button className="text-brand hover:underline" onClick={() => openDocument(t)}>
                      {t.number}
                    </button>
                  </td>
                  <td className="p-3">
                    {t.from_warehouse_name} → {t.to_warehouse_name}
                  </td>
                  <td className="p-3">{dateShort(t.date)}</td>
                  <td className="p-3 text-right">{t.items.length}</td>
                  <td className={`p-3 font-medium ${STATUS_CLASS[t.status] ?? ''}`}>
                    {t.status_display}
                  </td>
                  <td className="p-3">
                    {canWrite && (
                      <RowActions
                        transfer={t}
                        onSend={() => setPending({ kind: 'send', transfer: t })}
                        onCancel={() => setPending({ kind: 'cancel', transfer: t })}
                        onReceive={() => setReceiving(t)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={creating} title="Yangi ko'chirish" onClose={() => setCreating(false)}>
        <TransferForm onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        open={receiving !== null}
        title={`Qabul qilish — ${receiving?.number ?? ''}`}
        onClose={() => setReceiving(null)}
      >
        {receiving && (
          <TransferReceiveForm transfer={receiving} onDone={() => setReceiving(null)} />
        )}
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'send' ? "Ko'chirishni jo'natish" : "Ko'chirishni bekor qilish"}
        confirmLabel={pending?.kind === 'send' ? "Jo'natish" : 'Bekor qilish'}
        danger={pending?.kind === 'cancel'}
        isPending={action.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && action.mutate(pending)}
      >
        {pending?.kind === 'send'
          ? `${pending.transfer.number}: tovarlar «${pending.transfer.from_warehouse_name}» qoldig'idan chiqib, yo'lga chiqadi.`
          : `${pending?.transfer.number ?? ''} bekor qilinadi. Yo'ldagi tovar manba omborga qaytadi.`}
      </ConfirmDialog>

      <DocumentModal doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

function RowActions({
  transfer,
  onSend,
  onCancel,
  onReceive,
}: {
  transfer: Transfer;
  onSend: () => void;
  onCancel: () => void;
  onReceive: () => void;
}): ReactElement | null {
  const { status } = transfer;
  if (status !== 'DRAFT' && status !== 'SENT') return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <button className="btn px-3 py-1 text-xs text-danger" onClick={onCancel}>
        Bekor qilish
      </button>
      {status === 'DRAFT' ? (
        <button className="btn-brand px-3 py-1 text-xs" onClick={onSend}>
          Jo'natish
        </button>
      ) : (
        <button className="btn-brand px-3 py-1 text-xs" onClick={onReceive}>
          Qabul qilish
        </button>
      )}
    </div>
  );
}
