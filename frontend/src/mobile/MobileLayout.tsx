import {
  Boxes,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  Coins,
  HandCoins,
  House,
  type LucideIcon,
  PackagePlus,
  Plus,
  ShoppingCart,
  Store,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, type ReactElement } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';

import { SyncBadge } from '@/offline/SyncBadge';
import { useSync } from '@/offline/useSync';
import { fullSync } from '@/offline/sync';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { PinLockGate } from '@/shared/components/PinLockGate';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { hasUserPermission } from '@/shared/lib/permissions';
import { RealtimeBridge } from '@/shared/realtime/RealtimeBridge';
import { useAuthStore } from '@/shared/store/authStore';

type Tab = {
  to: string;
  label: string;
  Icon: LucideIcon;
  end: boolean;
  highlight?: boolean;
};

/** Zakaz oluvchiga ochiq sahifalar — qolganlari (sotuv, hamyon...) backendda ham yopiq */
const ORDER_TAKER_PATHS = [
  '/m', '/m/orders', '/m/order/new', '/m/clients', '/m/payroll',
  '/m/sync', '/m/profile', '/m/help',
];

const ADMIN_TABS: Tab[] = [
  { to: '/m', label: 'Bosh', Icon: House, end: true },
  { to: '/m/a/sales', label: 'Sotuv', Icon: ShoppingCart, end: false },
  { to: '/m/a/debts', label: 'Qarz', Icon: HandCoins, end: false },
  { to: '/m/a/dayclose', label: 'Kunlik', Icon: CalendarCheck, end: false },
  { to: '/m/a/reports', label: 'Hisobot', Icon: ChartColumn, end: false },
];

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'ACCOUNTANT'];

export function MobileLayout(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const sync = useSync();
  const location = useLocation();
  const role = user?.role;
  const canMakeSales = hasUserPermission(user, 'can_make_sales');
  const canTakeOrders = hasUserPermission(user, 'can_take_orders');
  const canReceiveStock = hasUserPermission(user, 'can_receive_stock');
  const canSeeWarehouseStock = hasUserPermission(user, 'can_see_warehouse_stock');

  const tabs = useMemo(() => {
    if (role != null && ADMIN_ROLES.includes(role)) {
      return ADMIN_TABS;
    }

    if (role === 'WAREHOUSE') {
      const items: Tab[] = [{ to: '/m', label: 'Bosh', Icon: House, end: true }];
      if (canTakeOrders) {
        items.push({ to: '/m/orders', label: 'Buyurtma', Icon: ClipboardList, end: false });
      }
      if (canMakeSales) {
        items.push({ to: '/m/sale', label: 'Tarqatish', Icon: Plus, end: false, highlight: true });
      }
      if (canReceiveStock) {
        items.push({ to: '/m/receive', label: 'Qabul', Icon: PackagePlus, end: false });
      }
      if (canSeeWarehouseStock) {
        items.push({ to: '/m/stock', label: 'Qoldiq', Icon: Boxes, end: false });
      }
      return items.slice(0, 5);
    }

    if (role === 'ORDER_TAKER') {
      const items: Tab[] = [{ to: '/m', label: 'Bosh', Icon: House, end: true }];
      if (canMakeSales) {
        items.push({ to: '/m/sale', label: 'Sotuv', Icon: Plus, end: false, highlight: true });
      } else if (canTakeOrders) {
        items.push({ to: '/m/order/new', label: '+ Yangi', Icon: Plus, end: false, highlight: true });
      }
      if (canTakeOrders) {
        items.push({ to: '/m/orders', label: 'Buyurtma', Icon: ClipboardList, end: false });
      }
      items.push({ to: '/m/clients', label: 'Mijozlar', Icon: Store, end: false });
      items.push({ to: '/m/payroll', label: 'Maosh', Icon: Coins, end: false });
      return items.slice(0, 5);
    }

    // Odatiy DISTRIBUTOR yoki boshqa dala xodimlari
    const items: Tab[] = [{ to: '/m', label: 'Bosh', Icon: House, end: true }];
    if (canMakeSales) {
      items.push({ to: '/m/sale', label: 'Sotuv', Icon: Plus, end: false, highlight: true });
    }
    if (canTakeOrders) {
      items.push({ to: '/m/orders', label: 'Buyurtma', Icon: ClipboardList, end: false });
    }
    items.push({ to: '/m/wallet', label: 'Hamyon', Icon: Wallet, end: false });
    items.push({ to: '/m/clients', label: 'Mijozlar', Icon: Store, end: false });
    return items.slice(0, 5);
  }, [role, canMakeSales, canTakeOrders, canReceiveStock, canSeeWarehouseStock]);

  const pathname = location.pathname.replace(/\/+$/, '') || '/m';

  // Huquqlar bo'yicha sahifaga kirish taqiqlanganmi?
  const isSaleBlocked = pathname.startsWith('/m/sale') && !canMakeSales;
  const isOrderBlocked = pathname.startsWith('/m/order') && !canTakeOrders;
  const isReceiveBlocked = pathname.startsWith('/m/receive') && !canReceiveStock;
  const isOrderTakerDefaultBlocked =
    role === 'ORDER_TAKER' && !canMakeSales && !ORDER_TAKER_PATHS.includes(pathname);

  const blocked =
    isSaleBlocked || isOrderBlocked || isReceiveBlocked || isOrderTakerDefaultBlocked;

  // Ochilishda avval navbatni yuboramiz, keyin tortamiz (UX N3)
  useEffect(() => {
    if (navigator.onLine) void fullSync().catch(() => undefined);
  }, []);

  return (
    <PinLockGate>
      <div className="mx-auto flex min-h-full max-w-md flex-col bg-gray-50 dark:bg-gray-950">
        <RealtimeBridge />
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 shadow-xs">
          <Link to="/m/profile" className="flex items-center gap-2.5 truncate text-sm font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-brand text-sm font-black">
              {(user?.full_name?.[0] || 'X').toUpperCase()}
            </span>
            <span className="truncate">{user?.full_name}</span>
            <span className="text-gray-400 font-normal">›</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <SyncBadge state={sync} />
          </div>
        </header>

        <main className="flex-1 p-4 pb-24">
          <ErrorBoundary key={location.pathname} variant="page">
            {blocked ? <Navigate to="/m" replace /> : <Outlet />}
          </ErrorBoundary>
        </main>

        {/* 5 ta ergonomik tugmali pastki menyu */}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-gray-200 bg-white/95 px-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 shadow-lg">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-h-[58px] min-w-[62px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${
                  tab.highlight
                    ? isActive
                      ? 'bg-emerald-600 text-white shadow-md font-black'
                      : 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 font-bold'
                    : isActive
                      ? 'text-brand font-black'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-semibold'
                }`
              }
            >
              <tab.Icon size={tab.highlight ? 24 : 22} aria-hidden />
              <span className="tracking-tight">{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </PinLockGate>
  );
}
