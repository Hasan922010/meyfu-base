// Frontenddagi yozish tugmalari uchun ruxsatlar — backenddagi write_roles /
// action_roles ning aynan nusxasi (audit K3b). Haqiqiy tekshiruv serverda;
// bu faqat foydalanuvchiga rad etiladigan tugmani ko'rsatmaslik uchun.
// Backend o'zgarsa — shu yerni ham yangilang.
import { useAuthStore } from '@/shared/store/authStore';
import type { Role } from '@/shared/types/api';

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
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function useCan(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, permission);
}
