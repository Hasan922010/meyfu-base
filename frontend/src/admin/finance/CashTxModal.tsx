import { useMutation } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { financeApi } from '@/shared/api/finance2';
import { AmountInput } from '@/shared/components/AmountInput';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';

const CASH_TYPES = [
  { v: 'OTHER_IN', l: 'Kirim (+)', out: false },
  { v: 'BANK_DEPOSIT', l: 'Bankka topshirish (−)', out: true },
  { v: 'SUPPLIER_PAYMENT', l: 'Yetkazib beruvchiga (−)', out: true },
  { v: 'OTHER_OUT', l: 'Chiqim (−)', out: true },
] as const;

// Backend ham shuni talab qiladi (finance/serializers.py): append-only jurnalda
// "boshqa chiqim"ning sababi keyin hech qayerdan topilmaydi.
const REASON_REQUIRED = new Set<string>(['OTHER_OUT']);

interface Props {
  open: boolean;
  /** Joriy kassa balansi (server qiymati, masalan "900000.00") */
  balance: string;
  onClose: () => void;
  onDone: () => void;
}

export function CashTxModal({ open, balance, onClose, onDone }: Props): ReactElement {
  const toast = useToast();
  const [type, setType] = useState<string>('OTHER_IN');
  const [amount, setAmount] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [negativeOk, setNegativeOk] = useState<boolean>(false);

  const isOut = CASH_TYPES.find((c) => c.v === type)?.out ?? false;
  const reasonRequired = REASON_REQUIRED.has(type);
  const balanceAfter = Number(balance) - Number(amount || 0);
  const goesNegative = isOut && Number(amount) > 0 && balanceAfter < 0;

  const reset = (): void => {
    setType('OTHER_IN');
    setAmount('');
    setCounterparty('');
    setNote('');
    setNegativeOk(false);
  };

  const mutation = useMutation({
    mutationFn: () =>
      financeApi.createCashTransaction({
        transaction_type: type,
        amount,
        counterparty,
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.push({ kind: 'success', title: 'Kassa yozuvi saqlandi' });
      reset();
      onDone();
    },
  });

  const canSave =
    Number(amount) > 0 &&
    (!reasonRequired || note.trim() !== '') &&
    (!goesNegative || negativeOk) &&
    !mutation.isPending;

  return (
    <Modal open={open} title="Kassa yozuvi" onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Turi</span>
          <select
            className="field"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setNegativeOk(false);
            }}
          >
            {CASH_TYPES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.l}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Summa</span>
          <AmountInput
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setNegativeOk(false);
            }}
            showWords={false}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kontragent (ixtiyoriy)</span>
          <input
            className="field"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{reasonRequired ? 'Sabab *' : 'Izoh (ixtiyoriy)'}</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {goesNegative && (
          <div className="space-y-2 rounded-lg bg-pending/10 px-3 py-2 text-sm">
            <p>
              Kassada {money(balance)} bor. Bu yozuvdan keyin balans{' '}
              <b className="text-danger">{money(balanceAfter)}</b> bo'ladi. Summani tekshiring.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={negativeOk}
                onChange={(e) => setNegativeOk(e.target.checked)}
              />
              <span>Balans manfiy bo‘lishini tasdiqlayman</span>
            </label>
          </div>
        )}

        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}
        <button className="btn-brand w-full" disabled={!canSave} onClick={() => mutation.mutate()}>
          Saqlash
        </button>
      </div>
    </Modal>
  );
}
