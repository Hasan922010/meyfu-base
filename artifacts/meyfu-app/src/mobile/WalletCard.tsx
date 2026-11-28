import { useQuery } from '@tanstack/react-query';
import { TriangleAlert, Wallet } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { walletApi } from '@/shared/api/finance';
import { money } from '@/shared/lib/format';

/** CLAUDE.md 4.4 / 12 — jonli hamyon, doim yuqorida. */
export function WalletCard(): ReactElement {
  const wallet = useQuery({
    queryKey: ['wallet', 'my'],
    queryFn: () => walletApi.my(),
    refetchInterval: 60_000,
  });

  const pending = Number(wallet.data?.pending_expense_amount ?? 0);
  const pendingHandover = Number(wallet.data?.pending_handover_amount ?? 0);

  return (
    <Link
      to="/m/wallet"
      className="block rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-4 text-white shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        <Wallet size={14} aria-hidden /> Qo'limdagi pul
        {wallet.isError && wallet.data && <span>· yangilanmadi</span>}
      </div>
      {/* Ma'lumot yo'q paytida "0 so'm" pul yo'qolgandek ko'rinardi (UX audit) */}
      {wallet.data ? (
        <>
          <div className="mt-1 text-3xl font-bold">{money(wallet.data.live_balance)}</div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/15 pt-2 text-xs">
            <div className="flex items-center justify-between gap-1 opacity-90">
              <span>Plastik:</span>
              <span className="font-semibold">{money(wallet.data.card_amount ?? '0')}</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="opacity-90">Umumiy:</span>
              <span className="font-bold">
                {money(wallet.data.total_collected ?? wallet.data.live_balance)}
              </span>
            </div>
            {Number(wallet.data.transfer_amount ?? 0) > 0 && (
              <div className="col-span-2 flex items-center justify-between gap-1 opacity-90">
                <span>O&apos;tkazma:</span>
                <span className="font-semibold">
                  {money(wallet.data.transfer_amount ?? '0')}
                </span>
              </div>
            )}
          </div>
        </>
      ) : wallet.isError ? (
        <div className="mt-2 text-sm font-medium">
          Balansni yuklab bo'lmadi — ochish uchun bosing
        </div>
      ) : (
        <div className="mt-1 text-3xl font-bold opacity-60" aria-busy="true">
          …
        </div>
      )}
      {pending > 0 && (
        <div className="mt-1 text-xs opacity-80">
          {money(wallet.data?.pending_expense_amount ?? '0')} tasdiqlanmagan xarajat
        </div>
      )}
      {pendingHandover > 0 && (
        <div className="mt-1 text-xs opacity-80">
          {money(wallet.data?.pending_handover_amount ?? '0')} kun yopishda topshirildi
        </div>
      )}
      {wallet.data && Number(wallet.data.balance) < 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-pending">
          <TriangleAlert size={12} aria-hidden /> Balans manfiy
        </div>
      )}
    </Link>
  );
}
