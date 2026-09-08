import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheckBig } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { saveDebtPaymentLocal } from '@/offline/actions';
import { useSync } from '@/offline/useSync';
import { debtsApi } from '@/shared/api/debts';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import type { Debt } from '@/shared/types/sales';

export function DebtCollectPage(): ReactElement {
  const qc = useQueryClient();
  const { online } = useSync();
  const [selected, setSelected] = useState<Debt | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'NAQD' | 'PLASTIK' | 'OTKAZMA'>('NAQD');
  const [saved, setSaved] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['debts', 'my'],
    queryFn: () => debtsApi.myRoute(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await saveDebtPaymentLocal({
        debt: selected.id,
        client_name: selected.client_name,
        amount: Number(amount),
        payment_type: type,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['debts', 'my'] });
      setSaved(true);
    },
  });

  const rows = query.data ?? [];
  const totalOwed = rows.reduce((s, d) => s + Number(d.remaining), 0);

  function close(): void {
    setSelected(null);
    setAmount('');
    setSaved(false);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Qarz undirish</h1>
      <div className="rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900">
        <div className="flex justify-between">
          <span className="text-gray-500">Marshrutimdagi jami qarz</span>
          <span className="font-semibold text-danger">{money(totalOwed)}</span>
        </div>
      </div>

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Qarzdor yo'q"
      >
        <ul className="space-y-2">
          {rows.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => {
                  setSelected(d);
                  setAmount(d.remaining);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm active:scale-[0.99] dark:bg-gray-900"
              >
                <div>
                  <div className="font-medium">{d.client_name}</div>
                  <div className="text-xs text-gray-500">
                    {d.sale_number ?? ''}
                    {d.due_date && ` · muddat ${dateShort(d.due_date)}`}
                    {d.status === 'OVERDUE' && (
                      <span className="ml-1 text-danger">muddati o'tgan</span>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-danger">{money(d.remaining)}</div>
              </button>
            </li>
          ))}
        </ul>
      </DataState>

      <Modal
        open={selected !== null}
        title={selected ? `Qarz: ${selected.client_name}` : ''}
        onClose={close}
      >
        {saved ? (
          <div className="space-y-3 py-6 text-center">
            <CircleCheckBig size={48} className="mx-auto text-success" aria-hidden />
            <p className="font-semibold">To'lov saqlandi</p>
            <p className="text-sm text-gray-500">
              {online
                ? 'Serverga yuborilmoqda…'
                : "Internet yo'q — ulanish paydo bo'lganda yuboriladi."}
            </p>
            <button className="btn-brand px-6" onClick={close}>
              Yopish
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              Qoldiq: {money(selected?.remaining ?? '0')}
            </div>
            <input
              className="field text-lg"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              {(['NAQD', 'PLASTIK', 'OTKAZMA'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setType(tp)}
                  className={`flex-1 rounded-lg py-2 text-xs ${
                    type === tp ? 'bg-brand text-brand-fg' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
            <button
              className="btn-brand w-full"
              disabled={
                Number(amount) <= 0 ||
                Number(amount) > Number(selected?.remaining ?? 0) ||
                mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              To'lovni qabul qilish
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
