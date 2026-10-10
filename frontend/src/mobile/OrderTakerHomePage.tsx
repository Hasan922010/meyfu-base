import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Coins,
  HandCoins,
  MapPin,
  Package,
  Plus,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ordersApi } from '@/shared/api/orders';
import { businessDateISO } from '@/shared/lib/businessDay';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

const LINKS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/m/orders', label: 'Buyurtmalarim', Icon: ClipboardList },
  { to: '/m/clients', label: 'Mijozlarim', Icon: Store },
  { to: '/m/stock', label: 'Ombor qoldig‘i', Icon: Package },
  { to: '/m/visits', label: 'Tashriflarim', Icon: MapPin },
  { to: '/m/debts', label: 'Qarzdorlar', Icon: HandCoins },
  { to: '/m/payroll', label: 'Maoshim', Icon: Coins },
];

/** Zakaz oluvchi bosh sahifasi — bugungi natija ochiq ko'rinadi (CLAUDE.md 8). */
export function OrderTakerHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const orders = useQuery({
    queryKey: ['orders', 'my-to-take'],
    queryFn: () => ordersApi.myToTake(),
  });

  const today = businessDateISO();
  const todays = (orders.data ?? []).filter(
    (o) => o.date === today && o.status !== 'CANCELLED',
  );
  const total = todays.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Assalomu alaykum,</h1>
        <p className="text-gray-500">{user?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <div className="text-xs text-gray-500">Bugungi buyurtmalar</div>
          <div className="text-2xl font-bold">{orders.isLoading ? '…' : todays.length}</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <div className="text-xs text-gray-500">Summasi</div>
          <div className="text-lg font-bold">{orders.isLoading ? '…' : money(total)}</div>
        </div>
      </div>

      <Link
        to="/m/order/new"
        className="btn-brand flex w-full items-center justify-center gap-2 py-4 text-base"
      >
        <Plus size={20} aria-hidden /> Yangi buyurtma
      </Link>

      <div className="grid grid-cols-3 gap-3">
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
    </div>
  );
}
