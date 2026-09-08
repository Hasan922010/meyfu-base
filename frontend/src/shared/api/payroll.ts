import {
  create,
  listPage,
  patch,
  postAction,
  remove,
  retrieve,
  type QueryParams,
} from '@/shared/api/crud';

export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export type CommissionScope = 'GLOBAL' | 'CATEGORY' | 'PRODUCT' | 'DISTRIBUTOR';
export type CommissionRole = 'ORDER' | 'DELIVERY';

export interface Payroll {
  id: string;
  distributor: string;
  distributor_name: string;
  period: string;
  total_sales: string;
  total_profit: string;
  commission_amount: string;
  order_commission_amount: string;
  delivery_commission_amount: string;
  base_salary: string;
  bonus: string;
  deduction_shortage: string;
  deduction_cash_diff: string;
  deduction_expense: string;
  reimbursement_expense: string;
  advance: string;
  total_deductions: string;
  final_amount: string;
  status: PayrollStatus;
  status_display: string;
  approved_at: string | null;
  paid_at: string | null;
  calculated_at: string | null;
  note: string;
  created_at: string;
}

export interface PayrollDetail {
  id: string;
  sale_number: string;
  sale_date: string;
  product_name: string;
  role: CommissionRole;
  role_display: string;
  beneficiary: string | null;
  beneficiary_name: string | null;
  percent: string;
  base_amount: string;
  commission_amount: string;
}

export interface PayrollWithDetails extends Payroll {
  details: PayrollDetail[];
}

export interface CommissionRule {
  id: string;
  scope: CommissionScope;
  scope_display: string;
  target_id: string | null;
  percent: string;
  valid_from: string;
  valid_to: string | null;
  priority: number;
  is_active: boolean;
  note: string;
  created_at: string;
}

export interface Advance {
  id: string;
  distributor: string;
  distributor_name: string;
  date: string;
  amount: string;
  note: string;
  payroll: string | null;
  created_at: string;
}

export interface PayrollManualInput {
  bonus?: string;
  deduction_shortage?: string;
  deduction_cash_diff?: string;
  deduction_expense?: string;
  reimbursement_expense?: string;
  note?: string;
}

export const payrollApi = {
  list: (params?: QueryParams) => listPage<Payroll>('/payrolls/', params),
  get: (id: string) => retrieve<PayrollWithDetails>(`/payrolls/${id}/`),
  my: () => retrieve<Payroll[]>('/payrolls/my/'),
  calculate: (distributor: string, period: string) =>
    postAction<PayrollWithDetails>('/payrolls/calculate/', { distributor, period }),
  edit: (id: string, body: PayrollManualInput) =>
    postAction<PayrollWithDetails>(`/payrolls/${id}/edit/`, body),
  approve: (id: string) => postAction<Payroll>(`/payrolls/${id}/approve/`),
  pay: (id: string) => postAction<Payroll>(`/payrolls/${id}/pay/`),
};

export const commissionRuleApi = {
  list: (params?: QueryParams) => listPage<CommissionRule>('/commission-rules/', params),
  create: (body: Partial<CommissionRule>) =>
    create<CommissionRule, Partial<CommissionRule>>('/commission-rules/', body),
  update: (id: string, body: Partial<CommissionRule>) =>
    patch<CommissionRule, Partial<CommissionRule>>(`/commission-rules/${id}/`, body),
  remove: (id: string) => remove(`/commission-rules/${id}/`),
};

export const advanceApi = {
  list: (params?: QueryParams) => listPage<Advance>('/advances/', params),
  my: () => listPage<Advance>('/advances/', { page_size: 100 }),
  create: (body: { distributor: string; amount: string; note?: string }) =>
    postAction<Advance>('/advances/', body),
};
