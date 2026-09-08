import { useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  CalendarCheck,
  ChartColumn,
  HandCoins,
  type LucideIcon,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { expensesApi } from '@/shared/api/finance';
import { dayCloseApi, reportsApi } from '@/shared/api/reports';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

const LINKS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/m/a/sales', label: 'Sotuvlar', Icon: ShoppingCart },
  { to: '/m/a/debts', label: 'Qarzdorlik', Icon: HandCoins },
  { to: '/m/a/reports', label: 'Hisobotlar', Icon: ChartColumn },
  // katalog/xodim CRUD — to'liq admin panelida (responsiv)
  { to: '/admin/products', label: 'Mahsulotlar', Icon: Package },
  { to: '/admin/staff', label: 'Xodimlar', Icon: Users },
];

export function MobileAdminHome(): ReactElement {
  const user = useAuthStore((s) => s.user);

  const dash = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => reportsApi.dashboard(),
  });
  const pendingExp = useQuery({
    queryKey: ['admin-expenses', { status: 'PENDING', page: 1 }],
    queryFn: () => expensesApi.list({ status: 'PENDING', page_size: 1 }),
  });
  const pendingDc = useQuery({
    queryKey: ['day-close', { status: 'PENDING' }],
    queryFn: () => dayCloseApi.list({ status: 'PENDING', page_size: 1 }),
  });

  const k = dash.data?.kpi;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Assalomu alaykum,</h1>
        <p className="text-gray-500">{user?.full_name}</p>
      </div>

      <DataState isLoading={dash.isLoading} isError={dash.isError}>
        {k && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Bugungi savdo" value={money(k.sales_total)} />
            <Kpi label="Sof foyda" value={money(k.profit)} accent="text-success" />
            <Kpi label="Naqd tushdi" value={money(k.cash_in)} />
            <Kpi label="Qarzga berildi" value={money(k.debt_given)} />
            <Kpi label="Qarz undirildi" value={money(k.debt_collected)} />
            <Kpi
              label="Umumiy qarz"
              value={money(k.outstanding_debt)}
              accent="text-danger"
            />
          </div>
        )}
      </DataState>

      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          to="/m/a/expenses"
          label="Xarajat tasdiqlash"
          count={pendingExp.data?.count ?? 0}
          Icon={BadgeDollarSign}
        />
        <ActionCard
          to="/m/a/dayclose"
          label="Kun yopishni tasdiqlash"
          count={pendingDc.data?.count ?? 0}
          Icon={CalendarCheck}
        />
      </div>

      {(k?.flagged_sales ?? 0) > 0 && (
        <Link
          to="/m/a/sales"
          className="block rounded-xl bg-pending/10 p-3 text-sm text-pending"
        >
          ⚠️ {k?.flagged_sales} ta belgilangan sotuv — ko'rib chiqing
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center text-xs shadow-sm dark:bg-gray-900"
          >
            <l.Icon size={22} className="text-brand" aria-hidden />
            {l.label}
          </Link>
        ))}
      </div>

      {dash.data?.by_distributor?.length ? (
        <section className="space-y-2">
          <div className="text-sm font-semibold">Tarqatuvchilar (bugun)</div>
          {dash.data.by_distributor.map((d) => (
            <div
              key={d.name}
              className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
            >
              <span>{d.name}</span>
              <span className="font-medium">
                {money(d.amount)} · {d.count}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

function ActionCard({
  to,
  label,
  count,
  Icon,
}: {
  to: string;
  label: string;
  count: number;
  Icon: LucideIcon;
}): ReactElement {
  return (
    <Link
      to={to}
      className="relative flex flex-col items-start gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
    >
      <Icon size={22} className="text-brand" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
      {count > 0 && (
        <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
