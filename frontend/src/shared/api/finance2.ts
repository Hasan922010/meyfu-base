import { create, listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';

export interface DebtAging {
  as_of: string;
  total_outstanding: string;
  overdue_total: string;
  buckets: {
    current: string;
    d1_30: string;
    d31_60: string;
    d61_90: string;
    d90_plus: string;
  };
  overdue_clients: Array<{
    client: string;
    phone: string;
    amount: string;
    max_days: number;
  }>;
}

export interface ProfitReport {
  date_from: string;
  date_to: string;
  revenue: string;
  gross_profit: string;
  distributor_expenses: string;
  company_expenses: string;
  company_expenses_by_category: Array<{ category: string; total: string }>;
  net_profit: string;
  cash_balance: string;
}

export interface CashAccount {
  id: string;
  name: string;
  balance: string;
  updated_at: string;
}

export interface CashTransaction {
  id: string;
  date: string;
  transaction_type: string;
  type_display: string;
  amount: string;
  balance_after: string;
  counterparty: string;
  note: string;
  created_at: string;
}

export interface CompanyExpense {
  id: string;
  date: string;
  category: string;
  category_display: string;
  amount: string;
  description: string;
  paid_from_cash: boolean;
  created_at: string;
}

export const financeApi = {
  debtAging: () => retrieve<DebtAging>('/reports/debt-aging/'),
  profit: (params?: QueryParams) => retrieve<ProfitReport>(`/reports/profit/${qs(params)}`),

  cashAccount: () => retrieve<CashAccount>('/cash-transactions/account/'),
  cashTransactions: (params?: QueryParams) =>
    listPage<CashTransaction>('/cash-transactions/', params),
  createCashTransaction: (body: {
    transaction_type: string;
    amount: string;
    counterparty?: string;
    note?: string;
  }) => postAction<CashTransaction>('/cash-transactions/', body),

  companyExpenses: (params?: QueryParams) =>
    listPage<CompanyExpense>('/company-expenses/', params),
  createCompanyExpense: (body: {
    category: string;
    amount: string;
    description?: string;
    paid_from_cash: boolean;
  }) => create<CompanyExpense, typeof body>('/company-expenses/', body),
};

function qs(params?: QueryParams): string {
  if (!params) return '';
  const e = Object.entries(params).filter(([, v]) => v !== undefined);
  return e.length ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
}
