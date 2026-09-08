// Backend javob formati (CLAUDE.md 10)

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | unknown[];
  };
}

export type Role =
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'WAREHOUSE'
  | 'DISTRIBUTOR'
  | 'ACCOUNTANT';

export interface DistributorProfile {
  vehicle_number: string;
  base_salary: string;
  commission_percent: string;
  order_commission_percent: string;
  delivery_commission_percent: string;
  monthly_plan: string;
  debt_limit: string;
  can_sell_below_price: boolean;
  daily_expense_limit: string;
  expenses_covered_by: 'COMPANY' | 'SALARY';
}

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: Role;
  avatar: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  passport_series?: string;
  address?: string;
  hire_date?: string | null;
  telegram_chat_id?: string;
  distributor_profile?: DistributorProfile | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface PaginatedData<T> {
  results: T[];
  count: number;
  page: number;
  pages: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}
