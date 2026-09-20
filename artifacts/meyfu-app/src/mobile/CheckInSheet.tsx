import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { Modal } from '@/shared/components/Modal';
import type { Client, VisitResult } from '@/shared/types/clients';

import { getCurrentCoords } from './geo';

const RESULTS: Array<{ value: VisitResult; label: string; cls: string }> = [
  { value: 'SOTUV', label: 'Sotuv bo‘ldi', cls: 'bg-success text-white' },
  { value: 'SOTUVSIZ', label: 'Sotuvsiz', cls: 'bg-pending text-white' },
  { value: 'YOPIQ', label: 'Yopiq edi', cls: 'bg-gray-500 text-white' },
];

function uuid(): string {
  return crypto.randomUUID();
}

export function CheckInSheet({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [note, setNote] = useState<string>('');

  const mutation = useMutation({
    mutationFn: async (result: VisitResult) => {
      if (!client) throw new Error('Mijoz tanlanmagan');
      const coords = await getCurrentCoords();
      return clientsApi.checkIn({
        client: client.id,
        result,
        note,
        client_uuid: uuid(),
        ...(coords ?? {}),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['visits'] });
      setNote('');
      onClose();
    },
  });

  return (
    <Modal
      open={client !== null}
      title={client ? `Tashrif: ${client.name}` : 'Tashrif'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          GPS faqat shu tashrif uchun yoziladi.
        </p>
        <textarea
          className="field min-h-[80px] py-2"
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
  );
}
