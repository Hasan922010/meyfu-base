import {
  create,
  listPage,
  patch,
  postAction,
  remove,
  type QueryParams,
} from '@/shared/api/crud';
import type { DistributorProfile, User } from '@/shared/types/api';

export const authApi = {
  distributors: async (): Promise<User[]> => {
    const page = await listPage<User>('/users/', {
      role: 'DISTRIBUTOR',
      is_active: true,
      page_size: 200,
    });
    return page.results;
  },
  /** Marshrutga biriktiriladigan zakaz oluvchilar */
  orderTakers: async (): Promise<User[]> => {
    const page = await listPage<User>('/users/', {
      role: 'ORDER_TAKER',
      is_active: true,
      page_size: 200,
    });
    return page.results;
  },
  /** Barcha faol xodimlar (rol cheklovisiz) — maosh barcha xodim turlari
   * uchun hisoblanadi (CLAUDE.md 6). */
  staff: async (): Promise<User[]> => {
    const page = await listPage<User>('/users/', {
      is_active: true,
      page_size: 200,
    });
    return page.results;
  },
};

export interface StaffInput {
  phone: string;
  full_name: string;
  role: User['role'];
  password?: string;
  passport_series?: string;
  address?: string;
  hire_date?: string | null;
  distributor_profile?: Partial<DistributorProfile>;
  /** Omborchi qaysi ombor/filialda ishlaydi */
  warehouse?: string | null;
  /** Faqat yaratishda: dastlabki hisob-kitob (musbat — xodimga berilgan avans,
   * manfiy — xodimning qarzi). CLAUDE.md 5. */
  opening_balance?: string;
  // Individual ruxsatlar
  can_receive_stock?: boolean;
  can_take_orders?: boolean;
  can_make_sales?: boolean;
  can_sell_on_debt?: boolean;
  can_collect_debts?: boolean;
  can_record_expenses?: boolean;
  can_see_warehouse_stock?: boolean;
  can_scan_invoices?: boolean;
}

export const staffApi = {
  list: (params?: QueryParams) => listPage<User>('/users/', params),
  create: (body: StaffInput) => create<User, StaffInput>('/users/', body),
  update: (id: string, body: Partial<StaffInput>) =>
    patch<User, StaffInput>(`/users/${id}/`, body),
  remove: (id: string) => remove(`/users/${id}/`),
  toggleActive: (id: string) => postAction<User>(`/users/${id}/toggle_active/`),
};
