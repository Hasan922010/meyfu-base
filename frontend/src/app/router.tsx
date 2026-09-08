import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import { AdminLayout } from '@/admin/AdminLayout';
import { ClientsPage } from '@/admin/clients/ClientsPage';
import { DashboardPage } from '@/admin/DashboardPage';
import { DistributorsPage } from '@/admin/distributors/DistributorsPage';
import { DayClosePage } from '@/admin/dayclose/DayClosePage';
import { ExpensesPage } from '@/admin/expenses/ExpensesPage';
import { DebtsPage } from '@/admin/finance/DebtsPage';
import { FinancePage } from '@/admin/finance/FinancePage';
import { OcrPage } from '@/admin/ocr/OcrPage';
import { OrdersPage } from '@/admin/orders/OrdersPage';
import { PayrollPage } from '@/admin/payroll/PayrollPage';
import { ProductsPage } from '@/admin/products/ProductsPage';
import { RefDataPage } from '@/admin/refdata/RefDataPage';
import { ReportsPage } from '@/admin/reports/ReportsPage';
import { RoutesPage } from '@/admin/routes/RoutesPage';
import { SalesPage } from '@/admin/sales/SalesPage';
import { SettingsPage } from '@/admin/SettingsPage';
import { StaffPage } from '@/admin/staff/StaffPage';
import { SystemHealthPage } from '@/admin/system/SystemHealthPage';
import { WarehousePage } from '@/admin/warehouse/WarehousePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { GuidePage } from '@/shared/help/GuidePage';
import { DayCloseWizard } from '@/mobile/DayCloseWizard';
import { DebtCollectPage } from '@/mobile/DebtCollectPage';
import { MobileAdminDayClose } from '@/mobile/admin/MobileAdminDayClose';
import { MobileAdminDebts } from '@/mobile/admin/MobileAdminDebts';
import { MobileAdminExpenses } from '@/mobile/admin/MobileAdminExpenses';
import { MobileAdminHome } from '@/mobile/admin/MobileAdminHome';
import { MobileAdminReports } from '@/mobile/admin/MobileAdminReports';
import { MobileAdminSales } from '@/mobile/admin/MobileAdminSales';
import { MobileHomePage } from '@/mobile/MobileHomePage';
import { MobileLayout } from '@/mobile/MobileLayout';
import { MobileReceivePage } from '@/mobile/MobileReceivePage';
import { MobileStockPage } from '@/mobile/MobileStockPage';
import { WarehouseHomePage } from '@/mobile/WarehouseHomePage';
import { MyClientsPage } from '@/mobile/MyClientsPage';
import { MyLoadingPage } from '@/mobile/MyLoadingPage';
import { MyExpensesPage } from '@/mobile/MyExpensesPage';
import { MyPayrollPage } from '@/mobile/MyPayrollPage';
import { MyReportPage } from '@/mobile/MyReportPage';
import { MyVanStockPage } from '@/mobile/MyVanStockPage';
import { MyVisitsPage } from '@/mobile/MyVisitsPage';
import { MyOrdersPage } from '@/mobile/MyOrdersPage';
import { NewExpensePage } from '@/mobile/NewExpensePage';
import { NewOrderPage } from '@/mobile/NewOrderPage';
import { NewSalePage } from '@/mobile/NewSalePage';
import { ProfilePage } from '@/mobile/ProfilePage';
import { ScanInvoicePage } from '@/mobile/ScanInvoicePage';
import { SyncPage } from '@/mobile/SyncPage';
import { WalletPage } from '@/mobile/WalletPage';
import { NotFound } from '@/shared/components/NotFound';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { isDesktopForced, useIsMobile } from '@/shared/lib/useIsMobile';
import { useAuthStore } from '@/shared/store/authStore';

const FIELD_ROLES = ['DISTRIBUTOR', 'WAREHOUSE'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];

function HomeRedirect(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const isMobile = useIsMobile();
  if (role == null) return <Navigate to="/login" replace />;
  if (FIELD_ROLES.includes(role)) return <Navigate to="/m" replace />;
  // admin: telefonda mobil, kompyuterda desktop (foydalanuvchi majburlamasa)
  const wantMobile = isMobile && !isDesktopForced();
  return <Navigate to={wantMobile ? '/m' : '/admin'} replace />;
}

function MobileHome(): ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'WAREHOUSE') return <WarehouseHomePage />;
  if (role != null && ADMIN_ROLES.includes(role)) return <MobileAdminHome />;
  return <MobileHomePage />;
}

// recharts og'ir — faqat kerak bo'lganda yuklanadi (mobil bundle'ga tushmaydi)
const DistributorCardPage = lazy(() =>
  import('@/admin/distributors/DistributorCardPage').then((m) => ({
    default: m.DistributorCardPage,
  })),
);

function Lazy({ children }: { children: ReactElement }): ReactElement {
  return (
    <Suspense fallback={<p className="p-6 text-gray-500">Yuklanmoqda…</p>}>
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <HomeRedirect />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute roles={['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'warehouse', element: <WarehousePage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'routes', element: <RoutesPage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'day-close', element: <DayClosePage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'debts', element: <DebtsPage /> },
      { path: 'finance', element: <FinancePage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'distributors', element: <DistributorsPage /> },
      {
        path: 'distributors/:id',
        element: (
          <Lazy>
            <DistributorCardPage />
          </Lazy>
        ),
      },
      { path: 'payroll', element: <PayrollPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'ocr', element: <OcrPage /> },
      { path: 'system', element: <SystemHealthPage /> },
      { path: 'refdata', element: <RefDataPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <GuidePage /> },
    ],
  },
  {
    path: '/m',
    element: (
      <ProtectedRoute
        roles={['DISTRIBUTOR', 'WAREHOUSE', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT']}
      >
        <MobileLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <MobileHome /> },
      { path: 'a/expenses', element: <MobileAdminExpenses /> },
      { path: 'a/dayclose', element: <MobileAdminDayClose /> },
      { path: 'a/reports', element: <MobileAdminReports /> },
      { path: 'a/sales', element: <MobileAdminSales /> },
      { path: 'a/debts', element: <MobileAdminDebts /> },
      { path: 'receive', element: <MobileReceivePage /> },
      { path: 'stock', element: <MobileStockPage /> },
      { path: 'loading', element: <MyLoadingPage /> },
      { path: 'orders', element: <MyOrdersPage /> },
      { path: 'order/new', element: <NewOrderPage /> },
      { path: 'sale', element: <NewSalePage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'expenses', element: <MyExpensesPage /> },
      { path: 'expense/new', element: <NewExpensePage /> },
      { path: 'payroll', element: <MyPayrollPage /> },
      { path: 'report', element: <MyReportPage /> },
      { path: 'debts', element: <DebtCollectPage /> },
      { path: 'clients', element: <MyClientsPage /> },
      { path: 'van', element: <MyVanStockPage /> },
      { path: 'visits', element: <MyVisitsPage /> },
      { path: 'close', element: <DayCloseWizard /> },
      { path: 'scan', element: <ScanInvoicePage /> },
      { path: 'sync', element: <SyncPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'help', element: <GuidePage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />;
}
