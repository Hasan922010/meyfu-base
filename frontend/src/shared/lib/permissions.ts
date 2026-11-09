// Frontenddagi yozish tugmalari uchun ruxsatlar — backenddagi write_roles /
// action_roles ning aynan nusxasi (audit K3b). Haqiqiy tekshiruv serverda;
// bu faqat foydalanuvchiga rad etiladigan tugmani ko'rsatmaslik uchun.
// Backend o'zgarsa — shu yerni ham yangilang.
import { useAuthStore } from '@/shared/store/authStore';
import type { Role, User } from '@/shared/types/api';

// BRANCH_MANAGER — backendda MANAGER huquqlarini oladi (core/permissions.py),
// ma'lumot esa o'z filialiga cheklanadi; markaziy sozlamalar (katalog, lug'atlar,
// kompaniya sozlamalari) unga yopiq.
export const PERMISSIONS = {
  /** users/views.py UserViewSet write_roles */
  staffWrite: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  /** finance/views.py CashTransactionViewSet, CompanyExpenseViewSet */
  cashWrite: ['SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER'],
  /** ocr/views.py _OCR */
  ocrWrite: ['WAREHOUSE', 'MANAGER', 'BRANCH_MANAGER', 'SUPER_ADMIN'],
  /** orders/views.py approve/cancel */
  orderManage: ['MANAGER', 'BRANCH_MANAGER', 'SUPER_ADMIN'],
  /** orders/views.py for_loading/build_loading */
  orderBuildLoading: ['WAREHOUSE', 'MANAGER', 'BRANCH_MANAGER', 'SUPER_ADMIN'],
  /** payroll/views.py calculate/edit/pay, advance create */
  payrollManage: ['SUPER_ADMIN', 'ACCOUNTANT'],
  /** payroll/views.py approve, CommissionRuleViewSet */
  payrollApprove: ['SUPER_ADMIN'],
  /** catalog/views.py BranchPriceViewSet */
  branchPriceWrite: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function useCan(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, permission);
}

export type UserFeaturePermission =
  | 'can_receive_stock'
  | 'can_take_orders'
  | 'can_make_sales'
  | 'can_sell_on_debt'
  | 'can_collect_debts'
  | 'can_record_expenses'
  | 'can_see_warehouse_stock'
  | 'can_scan_invoices';

export const USER_FEATURE_PERMISSIONS: UserFeaturePermission[] = [
  'can_receive_stock',
  'can_take_orders',
  'can_make_sales',
  'can_sell_on_debt',
  'can_collect_debts',
  'can_record_expenses',
  'can_see_warehouse_stock',
  'can_scan_invoices',
];

export const USER_FEATURE_PERMISSION_LABELS: Record<
  UserFeaturePermission,
  { label: string; description: string }
> = {
  can_receive_stock: {
    label: "Tovar kirim qilish",
    description: "Yetkazib beruvchilardan omborga tovar qabul qilish va kirim qilish",
  },
  can_take_orders: {
    label: "Buyurtma olish",
    description: "Mijozlardan yangi buyurtmalar qabul qilish va kiritish",
  },
  can_make_sales: {
    label: "Tarqatish / Sotuv",
    description: "Mijozlarga tovar tarqatish va sotuv amaliyotini bajarish",
  },
  can_sell_on_debt: {
    label: "Qarzga / Nasiyaga berish",
    description: "Mijozlarga qarzga yoki aralash to'lov bilan tovar sotish",
  },
  can_collect_debts: {
    label: "Pul / Qarz undirish",
    description: "Mijozlarning mavjud qarzlaridan to'lov undirish",
  },
  can_record_expenses: {
    label: "Yo'l xarajatlarini kiritish",
    description: "Yoqilg'i va boshqa kundalik operatsion xarajatlarni qayd etish",
  },
  can_see_warehouse_stock: {
    label: "Ombor qoldig'ini ko'rish",
    description: "Omborlardagi qoldiq tovarlar miqdorini ko'rish",
  },
  can_scan_invoices: {
    label: "Nakladnoy / Chek skaneri",
    description: "AI yordamida yuk xati va xarajat cheklarini skanerlash",
  },
};

export const ROLE_DEFAULT_PERMISSIONS: Partial<
  Record<Role, Record<UserFeaturePermission, boolean>>
> = {
  SUPER_ADMIN: {
    can_receive_stock: true,
    can_take_orders: true,
    can_make_sales: true,
    can_sell_on_debt: true,
    can_collect_debts: true,
    can_record_expenses: true,
    can_see_warehouse_stock: true,
    can_scan_invoices: true,
  },
  MANAGER: {
    can_receive_stock: true,
    can_take_orders: true,
    can_make_sales: true,
    can_sell_on_debt: true,
    can_collect_debts: true,
    can_record_expenses: true,
    can_see_warehouse_stock: true,
    can_scan_invoices: true,
  },
  BRANCH_MANAGER: {
    can_receive_stock: true,
    can_take_orders: true,
    can_make_sales: true,
    can_sell_on_debt: true,
    can_collect_debts: true,
    can_record_expenses: true,
    can_see_warehouse_stock: true,
    can_scan_invoices: true,
  },
  DISTRIBUTOR: {
    can_receive_stock: false,
    can_take_orders: true,
    can_make_sales: true,
    can_sell_on_debt: true,
    can_collect_debts: true,
    can_record_expenses: true,
    can_see_warehouse_stock: true,
    can_scan_invoices: false,
  },
  ORDER_TAKER: {
    can_receive_stock: false,
    can_take_orders: true,
    can_make_sales: false,
    can_sell_on_debt: false,
    can_collect_debts: false,
    can_record_expenses: false,
    can_see_warehouse_stock: true,
    can_scan_invoices: false,
  },
  WAREHOUSE: {
    can_receive_stock: true,
    can_take_orders: true,
    can_make_sales: true,
    can_sell_on_debt: true,
    can_collect_debts: true,
    can_record_expenses: false,
    can_see_warehouse_stock: true,
    can_scan_invoices: true,
  },
  ACCOUNTANT: {
    can_receive_stock: false,
    can_take_orders: false,
    can_make_sales: false,
    can_sell_on_debt: false,
    can_collect_debts: false,
    can_record_expenses: false,
    can_see_warehouse_stock: true,
    can_scan_invoices: false,
  },
};

export function hasUserPermission(
  user: User | null | undefined,
  permission: UserFeaturePermission
): boolean {
  // Foydalanuvchi obyekti yuklanmagan yoki test/offline rejimida bo'lsa amaliyotni to'xtatmaymiz
  if (!user) return true;
  if (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER') return true;
  if (user.permissions && typeof user.permissions[permission] === 'boolean') {
    return user.permissions[permission];
  }
  if (typeof user[permission] === 'boolean') {
    return Boolean(user[permission]);
  }
  if (user.role && ROLE_DEFAULT_PERMISSIONS[user.role]) {
    return Boolean(ROLE_DEFAULT_PERMISSIONS[user.role]?.[permission]);
  }
  return true;
}

export function useUserPermission(permission: UserFeaturePermission): boolean {
  const user = useAuthStore((s) => s.user);
  return hasUserPermission(user, permission);
}
