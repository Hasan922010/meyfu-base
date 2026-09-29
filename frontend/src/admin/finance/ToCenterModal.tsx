import { useMutation } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { financeApi } from '@/shared/api/finance2';
import { AmountInput } from '@/shared/components/AmountInput';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';

interface Props {
  open: boolean;
  /** Filial kassasidagi joriy balans */
  balance: string;
  branchName: string;
  onClose: () => void;
  onDone: () => void;
}

/** Filial kassasidan markazga pul topshirish (inkassatsiya). */
export function ToCenterModal({ open, balance, branchName, onClose, onDone }: Props): ReactElement {
  const toast = useToast();
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const tooMuch = Number(amount) > Number(balance);
  const mutation = useMutation({
    mutationFn: () => financeApi.transferToCenter({ amount, note: note.trim() }),
    onSuccess: () => {
      toast.push({ kind: 'success', title: 'Pul markazga topshirildi' });
      setAmount('');
      setNote('');
      onDone();
    },
  });

  return (
    <Modal open={open} title="Markazga topshirish" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          {branchName} kassasida: <b>{money(balance)}</b>
        </p>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Summa</span>
          <AmountInput value={amount} onChange={setAmount} showWords={false} />
        </label>
        {tooMuch && (
          <p className="text-sm text-danger">Kassadagi summadan ko'p topshirib bo'lmaydi.</p>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Izoh (ixtiyoriy)</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}
        <button
          className="btn-brand w-full"
          disabled={!(Number(amount) > 0) || tooMuch || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Topshirish
        </button>
      </div>
    </Modal>
  );
}
