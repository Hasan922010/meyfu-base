import { api } from '@/shared/api/client';
import { retrieve, type QueryParams } from '@/shared/api/crud';

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'custom';

export interface DistributorFull {
  distributor: {
    id: string;
    full_name: string;
    phone: string;
    route: string;
    hire_date: string | null;
    commission_percent: string;
    last_seen_at: string | null;
  };
  period: {
    preset: string;
    date_from: string;
    date_to: string;
    prev_from: string;
    prev_to: string;
  };
  sales: {
    total_amount: string;
    total_profit: string;
    sales_count: number;
    avg_check: string;
    items_sold_qty: string;
    cash_amount: string;
    card_amount: string;
    transfer_amount: string;
    debt_amount: string;
    plan: string;
    plan_completion_percent: number | null;
    returns_amount: string;
  };
  money: {
    cash_collected: string;
    debt_collected: string;
    expenses_total: string;
    handed_to_cashier: string;
    wallet_balance: string;
    cash_differences_total: string;
    shortage_days_count: number;
  };
  expenses: {
    total: string;
    by_category: Array<{ category: string; total: string }>;
    pending_count: number;
    rejected_amount: string;
    fuel: {
      liters: string;
      amount: string;
      avg_price: string;
      cost_per_sale_percent: number;
    };
  };
  debts: {
    given_total: string;
    collected_total: string;
    outstanding_total: string;
    overdue_amount: string;
    overdue_clients_count: number;
    collection_rate: number | null;
  };
  clients: {
    visited_count: number;
    sold_to_count: number;
    new_clients: number;
    no_sale_visits: number;
    top_clients: Array<{ client: string; amount: string; count: number }>;
  };
  products: {
    top_products: Array<{
      product: string;
      quantity: string;
      amount: string;
      profit: string;
    }>;
    categories: Array<{ category: string; amount: string }>;
  };
  stock: {
    loaded_amount: string;
    returned_amount: string;
    shortage_amount: string;
  };
  orders: {
    taken_count: number;
    taken_amount: string;
    delivered_count: number;
    delivered_amount: string;
    cancelled_count: number;
    pending_count: number;
  };
  payroll: {
    period: string;
    status: string;
    commission_earned: string;
    order_commission: string;
    delivery_commission: string;
    base_salary: string;
    bonus: string;
    deductions: { shortage: string; cash_diff: string; expense: string };
    reimbursements: string;
    advances: string;
    estimated_total: string;
  };
  charts: {
    daily_sales: Array<{
      date: string;
      amount: string;
      count: number;
      profit: string;
      expense: string;
    }>;
    payment_mix: Array<{ type: string; amount: string }>;
    hourly_activity: Array<{ hour: number; amount: string; count: number }>;
  };
  timeline: TimelineRow[];
  changes: Record<string, number | null>;
}

export interface TimelineRow {
  date: string;
  loaded: string;
  sold: string;
  sales_count: number;
  returned: string;
  cash: string;
  expense: string;
  handed: string;
  difference: string;
  status: string;
}

export interface ComparisonRow {
  id: string;
  full_name: string;
  sales: string;
  profit: string;
  sales_count: number;
  avg_check: string;
  cash_collected: string;
  expenses: string;
  shortage_days: number;
  plan: string;
  plan_completion_percent: number | null;
  rank: number;
}

function qs(params?: QueryParams): string {
  if (!params) return '';
  const e = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return e.length
    ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
}

export interface PeriodParams {
  [k: string]: string | undefined;
  preset?: PeriodPreset;
  date_from?: string;
  date_to?: string;
}

export const reports360Api = {
  full: (id: string, p: PeriodParams) =>
    retrieve<DistributorFull>(`/reports/distributor/${id}/full/${qs(p)}`),
  timeline: (id: string, p: PeriodParams) =>
    retrieve<{ date_from: string; date_to: string; rows: TimelineRow[] }>(
      `/reports/distributor/${id}/timeline/${qs(p)}`,
    ),
  comparison: (p: PeriodParams) =>
    retrieve<{ period: { preset: string; date_from: string; date_to: string }; rows: ComparisonRow[] }>(
      `/reports/distributor-comparison/${qs(p)}`,
    ),
  exportBlob: async (id: string, p: PeriodParams): Promise<Blob> => {
    const resp = await api.get(
      `/reports/export/${qs({ type: 'distributor', distributor: id, ...p })}`,
      { responseType: 'blob' },
    );
    return resp.data as Blob;
  },
};
