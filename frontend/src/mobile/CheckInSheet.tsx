import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, ShoppingCart } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { ClientStatement } from '@/admin/clients/ClientStatement';
import { newUuid } from '@/offline/outbox';
import { saveVisitLocal } from '@/offline/actions';
import { extractApiError } from '@/shared/api/client';
import { Modal } from '@/shared/components/Modal';
import type { Client, VisitResult } from '@/shared/types/clients';

import { usePrefetchedCoords } from './geo';

const RESULTS: Array<{ value: VisitResult; label: string; cls: string }> = [
  { value: 'SOTUV', label: 'Sotuv bo‘ldi', cls: 'bg-success text-white' },
  { value: 'SOTUVSIZ', label: 'Sotuvsiz', cls: 'bg-pending text-white' },
  { value: 'YOPIQ', label: 'Yopiq edi', cls: 'bg-gray-500 text-white' },
];

export function CheckInSheet({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState<string>('');
  const [showStatement, setShowStatement] = useState<boolean>(false);
  // Oyna ochilganda GPS boshlanadi — tashrif GPS ni 8 s kutmaydi (UX N4)
  const coordsForSave = usePrefetchedCoords(client != null);
  // Har ochilgan oyna — bitta tashrif: qayta bosish dublikat yaratmaydi (FE-103)
  const [visitUuid, setVisitUuid] = useState<string>(newUuid);
  useEffect(() => {
    if (client) setVisitUuid(newUuid());
  }, [client]);

  const mutation = useMutation({
    mutationFn: async (result: VisitResult) => {
      if (!client) throw new Error('Mijoz tanlanmagan');
      const coords = await coordsForSave();
      // Offline-first: avval lokal navbat, keyin fonda yuboriladi (CLAUDE.md 4.2)
      return saveVisitLocal({
        client: client.id,
        client_name: client.name,
        result,
        note,
        clientUuid: visitUuid,
        ...(coords ?? {}),
      });
    },
    onSuccess: (_data, result) => {
      void qc.invalidateQueries({ queryKey: ['visits'] });
      setNote('');
      onClose();
      if (result === 'SOTUV' && client) {
        void navigate(`/m/sale/new?client=${client.id}`);
      }
    },
  });

  return (
    <>
      <Modal
        open={client !== null && !showStatement}
        title={client ? `Tashrif: ${client.name}` : 'Tashrif'}
        onClose={onClose}
      >
        <div className="space-y-4">
          {client && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-brand flex flex-1 items-center justify-center gap-1.5 py-2.5 font-medium"
                onClick={() => {
                  onClose();
                  void navigate(`/m/sale/new?client=${client.id}`);
                }}
              >
                <ShoppingCart size={16} aria-hidden /> Sotuv qilish
              </button>
              <button
                type="button"
                className="btn flex flex-1 items-center justify-center gap-1.5 border border-brand py-2.5 text-brand hover:bg-brand/5"
                onClick={() => setShowStatement(true)}
              >
                <FileText size={16} aria-hidden /> Akt-sverka
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Tashrif natijasini belgilang (GPS shu lahzada yoziladi):
          </p>
        <textarea
          className="field min-h-[80px] py-2"
          aria-label="Tashrif izohi"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}
        <div className="grid gap-2">
          {RESULTS.map((r) => (
            <button
              key={r.value}
              className={`btn ${r.cls}`}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>

    {client && (
      <Modal
        open={showStatement}
        title={`Akt-sverka: ${client.name}`}
        onClose={() => setShowStatement(false)}
      >
        <ClientStatement clientId={client.id} />
      </Modal>
    )}
  </>
);
}
