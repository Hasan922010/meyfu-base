import {
  BadgeDollarSign,
  Boxes,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  House,
  type LucideIcon,
  PackagePlus,
  Plus,
  Receipt,
  ScanLine,
  ShoppingCart,
  Store,
  Wallet,
} from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { SyncBadge } from '@/offline/SyncBadge';
import { useSync } from '@/offline/useSync';
import { pullReferenceData } from '@/offline/sync';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { RealtimeBridge } from '@/shared/realtime/RealtimeBridge';
import { useAuthStore } from '@/shared/store/authStore';

type Tab = { to: string; label: string; Icon: LucideIcon; end: boolean };

const DISTRIBUTOR_TABS: Tab[] = [
  { to: '/m', label: 'Bosh', Icon: House, end: true },
  { to: '/m/sale', label: 'Sotuv', Icon: Plus, end: false },
  { to: '/m/orders', label: 'Zakaz', Icon: ClipboardList, end: false },
  { to: '/m/wallet', label: 'Hamyon', Icon: Wallet, end: false },
  { to: '/m/expenses', label: 'Xarajat', Icon: Receipt, end: false },
  { to: '/m/clients', label: 'Mijozlar', Icon: Store, end: false },
];

const WAREHOUSE_TABS: Tab[] = [
  { to: '/m', label: 'Bosh', Icon: House, end: true },
  { to: '/m/receive', label: 'Qabul', Icon: PackagePlus, end: false },
  { to: '/m/scan', label: 'Skan', Icon: ScanLine, end: false },
  { to: '/m/stock', label: 'Qoldiq', Icon: Boxes, end: false },
];

const ADMIN_TABS: Tab[] = [
  { to: '/m', label: 'Bosh', Icon: House, end: true },
  { to: '/m/a/expenses', label: 'Xarajat', Icon: BadgeDollarSign, end: false },
  { to: '/m/a/dayclose', label: 'Kunlik', Icon: CalendarCheck, end: false },
  { to: '/m/a/sales', label: 'Sotuv', Icon: ShoppingCart, end: false },
  { to: '/m/a/reports', label: 'Hisobot', Icon: ChartColumn, end: false },
];

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];

export function MobileLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const sync = useSync();
  const role = user?.role;
  const tabs =
    role === 'WAREHOUSE'
      ? WAREHOUSE_TABS
      : role != null && ADMIN_ROLES.includes(role)
        ? ADMIN_TABS
        : DISTRIBUTOR_TABS;

  useEffect(() => {
    if (navigator.onLine) void pullReferenceData().catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <RealtimeBridge />
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Link to="/m/profile" className="truncate text-sm font-semibold">
          {user?.full_name} ›
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <SyncBadge state={sync} />
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-800 dark:bg-gray-900">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive ? 'text-brand' : 'text-gray-500'
              }`
            }
          >
            <tab.Icon size={22} aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
