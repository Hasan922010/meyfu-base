import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Coins,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Menu,
  Package,
  Route,
  ScanLine,
  Settings,
  ShoppingCart,
  Store,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { logout } from '@/shared/api/auth';
import { ConnectionBadge } from '@/shared/components/ConnectionBadge';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { RealtimeBridge } from '@/shared/realtime/RealtimeBridge';
import { setDesktopForced } from '@/shared/lib/useIsMobile';
import { useAuthStore } from '@/shared/store/authStore';

const NAV: { to: string; key: string; end: boolean; Icon: LucideIcon }[] = [
  { to: '/admin', key: 'nav.dashboard', end: true, Icon: LayoutDashboard },
  { to: '/admin/products', key: 'nav.products', end: false, Icon: Package },
  { to: '/admin/warehouse', key: 'nav.warehouse', end: false, Icon: Warehouse },
  { to: '/admin/ocr', key: 'nav.ocr', end: false, Icon: ScanLine },
  { to: '/admin/clients', key: 'nav.clients', end: false, Icon: Store },
  { to: '/admin/routes', key: 'nav.routes', end: false, Icon: Route },
  { to: '/admin/sales', key: 'nav.sales', end: false, Icon: ShoppingCart },
  { to: '/admin/orders', key: 'nav.orders', end: false, Icon: ClipboardList },
  { to: '/admin/expenses', key: 'nav.expenses', end: false, Icon: Wallet },
  { to: '/admin/day-close', key: 'nav.dayClose', end: false, Icon: CalendarCheck },
  { to: '/admin/debts', key: 'nav.debts', end: false, Icon: HandCoins },
  { to: '/admin/finance', key: 'nav.finance', end: false, Icon: Landmark },
  { to: '/admin/staff', key: 'nav.staff', end: false, Icon: UserCog },
  { to: '/admin/distributors', key: 'nav.distributors', end: false, Icon: Users },
  { to: '/admin/payroll', key: 'nav.payroll', end: false, Icon: Coins },
  { to: '/admin/reports', key: 'nav.reports', end: false, Icon: BarChart3 },
  { to: '/admin/system', key: 'nav.system', end: false, Icon: Activity },
  { to: '/admin/refdata', key: 'nav.refdata', end: false, Icon: Library },
  { to: '/admin/settings', key: 'nav.settings', end: false, Icon: Settings },
  { to: '/admin/help', key: 'nav.help', end: false, Icon: BookOpen },
];

export function AdminLayout(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [drawer, setDrawer] = useState<boolean>(false);

  // Sahifa almashganda mobil menyu yopiladi
  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  async function handleLogout(): Promise<void> {
    await logout();
    clear();
    navigate('/login', { replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? 'bg-brand text-brand-fg'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`
          }
        >
          <item.Icon size={18} className="shrink-0" aria-hidden />
          {t(item.key)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full md:grid md:grid-cols-[220px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex">
        <div className="px-5 pt-4 text-lg font-bold text-brand">{t('app.name')}</div>
        {nav}
      </aside>

      {/* Mobil drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-lg font-bold text-brand">{t('app.name')}</span>
              <button
                onClick={() => setDrawer(false)}
                className="rounded-lg p-1 text-gray-400"
                aria-label={t('common.close', 'Yopish')}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <RealtimeBridge />
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawer(true)}
              className="rounded-lg p-1 text-gray-500 md:hidden"
              aria-label={t('common.menu', 'Menyu')}
            >
              <Menu size={22} aria-hidden />
            </button>
            <ConnectionBadge />
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <NotificationBell />
            <button
              onClick={() => {
                setDesktopForced(false);
                window.location.href = '/m';
              }}
              className="text-brand hover:underline md:hidden"
              aria-label="Mobil versiya"
            >
              📱
            </button>
            <span className="hidden truncate text-gray-500 sm:inline">
              {user?.full_name}
            </span>
            <button
              onClick={() => void handleLogout()}
              className="text-danger hover:underline"
            >
              {t('auth.logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
