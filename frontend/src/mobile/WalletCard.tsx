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

  const live = wallet.data?.live_balance ?? '0';
  const pending = Number(wallet.data?.pending_expense_amount ?? 0);

  return (
    <Link
      to="/m/wallet"
      className="block rounded-2xl bg-gradient-to-br from-brand to-indigo-700 p-4 text-white shadow-sm"
    >
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        <Wallet size={14} aria-hidden /> Qo'limdagi pul
      </div>
      <div className="mt-1 text-3xl font-bold">{money(live)}</div>
      {pending > 0 && (
        <div className="mt-1 text-xs opacity-80">
          {money(wallet.data?.pending_expense_amount ?? '0')} tasdiqlanmagan xarajat
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
