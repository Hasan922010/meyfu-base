import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
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
  PiggyBank,
  RefreshCw,
  Route,
  ScanLine,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Smartphone,
  Store,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { logout } from '@/shared/api/auth';
import { ConnectionBadge } from '@/shared/components/ConnectionBadge';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { RealtimeBridge } from '@/shared/realtime/RealtimeBridge';
import { setDesktopForced } from '@/shared/lib/useIsMobile';
import { useAuthStore } from '@/shared/store/authStore';

export interface NavItem {
  to: string;
  key: string;
  end: boolean;
  Icon: LucideIcon;
  centralOnly?: boolean;
  hiddenFor?: string[];
}

export interface NavGroup {
  id: string;
  title: string;
  Icon: LucideIcon;
  colorClass: string;
  items: NavItem[];
}

/**
 * "7 yoshli bola ham tushunadigan" 5 ta asosiy bo'limga ajratilgan menyular iyerarxiyasi (Miller's Law).
 * 24 ta tarqoq menyu 5 ta mantiqiy biznes guruhiga birlashtirildi.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    title: 'Boshqaruv & Tahlil',
    Icon: LayoutDashboard,
    colorClass: 'text-blue-500 dark:text-blue-400',
    items: [
      { to: '/admin', key: 'nav.dashboard', end: true, Icon: LayoutDashboard },
      { to: '/admin/reports', key: 'nav.reports', end: false, Icon: BarChart3 },
      { to: '/admin/branches', key: 'nav.branches', end: false, Icon: Building2 },
    ],
  },
  {
    id: 'warehouse',
    title: 'Ombor & Tovarlar',
    Icon: Warehouse,
    colorClass: 'text-emerald-500 dark:text-emerald-400',
    items: [
      { to: '/admin/products', key: 'nav.products', end: false, Icon: Package },
      { to: '/admin/warehouse', key: 'nav.warehouse', end: false, Icon: Warehouse },
      { to: '/admin/ocr', key: 'nav.ocr', end: false, Icon: ScanLine },
      { to: '/admin/opening-balances', key: 'nav.openingBalances', end: false, Icon: PiggyBank },
    ],
  },
  {
    id: 'sales',
    title: 'Savdo & Yetkazish',
    Icon: ShoppingCart,
    colorClass: 'text-amber-500 dark:text-amber-400',
    items: [
      { to: '/admin/sales', key: 'nav.sales', end: false, Icon: ShoppingCart },
      { to: '/admin/orders', key: 'nav.orders', end: false, Icon: ClipboardList },
      { to: '/admin/clients', key: 'nav.clients', end: false, Icon: Store },
      { to: '/admin/routes', key: 'nav.routes', end: false, Icon: Route },
      { to: '/admin/day-close', key: 'nav.dayClose', end: false, Icon: CalendarCheck },
    ],
  },
  {
    id: 'finance',
    title: 'Moliya & Kassa',
    Icon: Landmark,
    colorClass: 'text-purple-500 dark:text-purple-400',
    items: [
      { to: '/admin/finance', key: 'nav.finance', end: false, Icon: Landmark },
      { to: '/admin/debts', key: 'nav.debts', end: false, Icon: HandCoins },
      { to: '/admin/expenses', key: 'nav.expenses', end: false, Icon: Wallet },
      { to: '/admin/payroll', key: 'nav.payroll', end: false, Icon: Coins },
    ],
  },
  {
    id: 'system',
    title: 'Jamoa & Sozlamalar',
    Icon: Settings,
    colorClass: 'text-gray-500 dark:text-gray-400',
    items: [
      { to: '/admin/staff', key: 'nav.staff', end: false, Icon: UserCog },
      { to: '/admin/distributors', key: 'nav.distributors', end: false, Icon: Users },
      { to: '/admin/refdata', key: 'nav.refdata', end: false, Icon: Library, centralOnly: true },
      { to: '/admin/sync-log', key: 'nav.syncLog', end: false, Icon: RefreshCw, hiddenFor: ['WAREHOUSE'] },
      { to: '/admin/audit', key: 'nav.audit', end: false, Icon: ScrollText, hiddenFor: ['WAREHOUSE'] },
      { to: '/admin/system', key: 'nav.system', end: false, Icon: Activity, centralOnly: true },
      { to: '/admin/settings', key: 'nav.settings', end: false, Icon: Settings, centralOnly: true },
      { to: '/admin/help', key: 'nav.help', end: false, Icon: BookOpen },
    ],
  },
];

export function AdminLayout(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  // Sahifa almashganda mobil menyu yopiladi
  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  async function handleLogout(): Promise<void> {
    await logout();
    clear();
    void navigate('/login', { replace: true });
  }

  const isBranchManager = user?.role === 'BRANCH_MANAGER';

  // Foydalanuvchi ruxsatiga va qidiruviga mos guruhlar
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    return NAV_GROUPS.map((group) => {
      const validItems = group.items.filter((item) => {
        if (isBranchManager && item.centralOnly) return false;
        if (user?.role && item.hiddenFor?.includes(user.role)) return false;
        if (!q) return true;

        const label = t(item.key).toLowerCase();
        return label.includes(q);
      });

      return {
        ...group,
        items: validItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [isBranchManager, user?.role, search, t]);

  const navContent = (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Tezkor qidiruv maydoni */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bo‘limni qidirish…"
            className="w-full rounded-xl bg-gray-100/90 py-2.5 pl-9 pr-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-brand/30 dark:bg-gray-800/90 dark:text-gray-100 dark:focus:bg-gray-800"
            aria-label="Menyuni qidirish"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 5 ta mantiqiy bo'lim */}
      <nav className="flex-1 space-y-5 p-4">
        {filteredGroups.map((group) => (
          <div key={group.id} className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <group.Icon size={16} className={group.colorClass} aria-hidden />
              <span>{group.title}</span>
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-brand text-brand-fg font-bold shadow-xs'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                    }`
                  }
                >
                  <item.Icon size={20} className="shrink-0" aria-hidden />
                  <span className="truncate">{t(item.key)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Pastdagi xodim kartochkasi */}
      <div className="border-t border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
          <div className="min-w-0 pr-2">
            <div className="truncate font-bold text-gray-900 dark:text-gray-100">{user?.full_name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user?.role === 'SUPER_ADMIN' ? 'Bosh Administrator' : user?.role || 'Xodim'}
            </div>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 transition"
            title={t('auth.logout')}
            aria-label={t('auth.logout')}
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full md:grid md:grid-cols-[280px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-fg font-black text-lg shadow-sm">
            M
          </span>
          <div>
            <span className="text-lg font-black tracking-tight text-brand">
              {t('app.name')}
            </span>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Boshqaruv Tizimi
            </span>
          </div>
        </div>
        {navContent}
      </aside>

      {/* Mobil drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-80 flex-col bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-fg font-black text-lg">
                  M
                </span>
                <span className="text-lg font-bold text-brand">{t('app.name')}</span>
              </div>
              <button
                onClick={() => setDrawer(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('common.close', 'Yopish')}
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <RealtimeBridge />
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawer(true)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              aria-label={t('common.menu', 'Menyu')}
            >
              <Menu size={22} aria-hidden />
            </button>
            <ConnectionBadge />
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <ThemeToggle />
            <NotificationBell />
            <button
              onClick={() => {
                setDesktopForced(false);
                window.location.href = '/m';
              }}
              className="flex items-center gap-1 text-xs text-brand font-medium hover:underline md:hidden"
              aria-label="Mobil versiya"
            >
              <Smartphone size={16} aria-hidden />
              <span>Mobil</span>
            </button>
            <span className="hidden truncate text-xs text-gray-500 sm:inline font-medium">
              {user?.full_name}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <ErrorBoundary key={location.pathname} variant="page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
