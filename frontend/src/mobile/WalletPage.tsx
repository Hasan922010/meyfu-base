import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { walletApi } from '@/shared/api/finance';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';

const SIGN_CLASS: Record<string, string> = {
  SALE_CASH: 'text-success',
  DEBT_COLLECTED: 'text-success',
  ADVANCE: 'text-success',
  EXPENSE: 'text-danger',
  HANDOVER: 'text-danger',
  CORRECTION: 'text-gray-500',
};

export function WalletPage(): ReactElement {
  const wallet = useQuery({ queryKey: ['wallet', 'my'], queryFn: () => walletApi.my() });
  const txs = useQuery({
    queryKey: ['wallet', 'my', 'tx'],
    queryFn: () => walletApi.myTransactions(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Hamyon</h1>

      <div className="rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-5 text-white">
        <div className="text-xs opacity-80">Qo'limdagi pul</div>
        <div className="mt-1 text-3xl font-bold">
          {money(wallet.data?.live_balance ?? '0')}
        </div>
        <div className="mt-2 space-y-0.5 text-xs opacity-90">
          <div className="flex justify-between">
            <span>Rasmiy balans</span>
            <span>{money(wallet.data?.balance ?? '0')}</span>
          </div>
          <div className="flex justify-between">
            <span>Tasdiqlanmagan xarajat</span>
            <span>−{money(wallet.data?.pending_expense_amount ?? '0')}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Kassaga topshirish — kunni yopish paytida amalga oshiriladi.
      </p>

      <h2 className="font-semibold">Tranzaksiyalar</h2>
      <DataState
        isLoading={txs.isLoading}
        isError={txs.isError}
        isEmpty={!txs.isLoading && (txs.data?.length ?? 0) === 0}
        emptyText="Hali tranzaksiya yo'q"
      >
        <ul className="space-y-2">
          {txs.data?.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div>
                <div className="text-sm font-medium">{t.type_display}</div>
                <div className="text-xs text-gray-500">
                  {dateShort(t.date)} {t.note && `· ${t.note}`}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${SIGN_CLASS[t.transaction_type] ?? ''}`}>
                  {Number(t.amount) > 0 ? '+' : ''}
                  {money(t.amount)}
                </div>
                <div className="text-xs text-gray-400">
                  → {money(t.balance_after)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}
