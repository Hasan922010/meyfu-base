import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ChartColumn,
  ClipboardList,
  Coins,
  HandCoins,
  type LucideIcon,
  MapPin,
  PackageOpen,
  Receipt,
  RefreshCw,
  ScanLine,
  Truck,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { clientsApi } from '@/shared/api/clients';
import { dayCloseApi } from '@/shared/api/reports';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

import { WalletCard } from './WalletCard';

const LINKS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/m/orders', label: 'Buyurtmalar', Icon: ClipboardList },
  { to: '/m/loading', label: 'Yuklama', Icon: PackageOpen },
  { to: '/m/van', label: 'Mashina qoldig‘i', Icon: Truck },
  { to: '/m/debts', label: 'Qarz undirish', Icon: HandCoins },
  { to: '/m/expenses', label: 'Xarajatlar', Icon: Receipt },
  { to: '/m/scan', label: 'Naklit skani', Icon: ScanLine },
  { to: '/m/visits', label: 'Tashriflar', Icon: MapPin },
  { to: '/m/report', label: 'Mening hisobotim', Icon: ChartColumn },
  { to: '/m/payroll', label: 'Mening maoshim', Icon: Coins },
  { to: '/m/sync', label: 'Sinxronizatsiya', Icon: RefreshCw },
  { to: '/m/help', label: "Yo'riqnoma", Icon: BookOpen },
];

export function MobileHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const routes = useQuery({
    queryKey: ['routes', 'my'],
    queryFn: () => clientsApi.myRoutes(),
  });
  const today = useQuery({
    queryKey: ['day-close', 'my-today'],
    queryFn: () => dayCloseApi.myToday(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Assalomu alaykum,</h1>
        <p className="text-gray-500">{user?.full_name}</p>
      </div>

      <WalletCard />

      {today.data && !today.data.submitted && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center text-sm shadow-sm dark:bg-gray-900">
          <div>
            <div className="text-gray-500">Sotildi</div>
            <div className="font-semibold">{money(today.data.sold_amount ?? '0')}</div>
          </div>
          <div>
            <div className="text-gray-500">Sotuvlar</div>
            <div className="font-semibold">{today.data.sales_count ?? 0}</div>
          </div>
          <div>
            <div className="text-gray-500">Tashrif</div>
            <div className="font-semibold">{today.data.visits_count ?? 0}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/m/sale" className="btn-brand">
          + Yangi sotuv
        </Link>
        <Link to="/m/close" className="btn bg-pending text-white">
          {today.data?.submitted ? 'Kun yopilgan' : 'Kunni yopish'}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1 rounded-xl bg-white p-3 text-center text-xs shadow-sm dark:bg-gray-900"
          >
            <l.Icon size={24} className="text-brand" aria-hidden />
            {l.label}
          </Link>
        ))}
      </div>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Mening marshrutlarim</div>
        {routes.data?.length ? (
          routes.data.map((r) => (
            <Link
              key={r.id}
              to="/m/clients"
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-500">
                  {r.days_display.join(', ') || 'Kunlar belgilanmagan'}
                </div>
              </div>
              <span className="text-sm text-gray-500">{r.clients_count} mijoz</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-gray-400">Marshrut biriktirilmagan.</p>
        )}
      </section>
    </div>
  );
}
