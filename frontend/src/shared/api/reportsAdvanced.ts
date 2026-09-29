import { api } from '@/shared/api/client';
import { api } from '@/shared/api/client';
import { retrieve, type QueryParams } from '@/shared/api/crud';

export type ReportDimension =
  | 'day'
  | 'distributor'
  | 'product'
  | 'category'
  | 'client'
  | 'route'
  | 'payment_type';

export interface QueryRow {
  [key: string]: string | number;
  amount: string;
  profit: string;
  qty: string;
  count: number;
  margin_percent: number;
}

export interface ReportQueryResult {
  dimension: string;
  date_from: string;
  date_to: string;
  key: string;
  rows: QueryRow[];
  totals: {
    amount: string;
    profit: string;
    qty: string;
    count: number;
    margin_percent: number;
  };
}

export interface AbcRow {
  [key: string]: string | number;
  amount: string;
  profit: string;
  share_percent: number;
  cumulative_percent: number;
  abc_class: 'A' | 'B' | 'C';
}

export interface AbcResult {
  dimension: string;
  key: string;
  date_from: string;
  date_to: string;
  grand_total: string;
  summary: Array<{
    abc_class: 'A' | 'B' | 'C';
    count: number;
    amount: string;
    amount_percent: number;
  }>;
  rows: AbcRow[];
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

function toQ(params?: QueryParams): string {
  if (!params) return '';
  const e = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return e.length
    ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
}

export interface ReorderRow {
  product: string;
  name: string;
  sku: string;
  avg_daily: string;
  stock: string;
  on_vans: string;
  days_left: string | null;
  suggested: string;
  status: 'URGENT' | 'SOON' | 'OK';
}

export interface ReorderResult {
  days: number;
  cover_days: number;
  since: string;
  rows: ReorderRow[];
}

export interface ExpenseAnomalyRow {
  id: string;
  date: string;
  distributor: string;
  category: string;
  amount: string;
  typical: string;
  times_typical: number | null;
  z_score: number;
  status: string;
  description: string;
}

export const reportsAdvancedApi = {
  /** v5 C6: 1C uchun XML/CSV fayl */
  export1c: async (params: QueryParams): Promise<Blob> => {
    const resp = await api.get(`/reports/export-1c/${toQ(params)}`, { responseType: 'blob' });
    return resp.data as Blob;
  },
  /** v5 C5: odatdagidan katta xarajatlar (z-score) */
  expenseAnomalies: (params: QueryParams) =>
    retrieve<{ threshold: number; rows: ExpenseAnomalyRow[] }>(
      `/reports/expense-anomalies/${toQ(params)}`,
    ),
  /** v5 C1: qoldiq prognozi va buyurtma tavsiyasi */
  reorder: (params: QueryParams) =>
    retrieve<ReorderResult>(`/reports/reorder/${toQ(params)}`),
  query: (params: QueryParams) =>
    retrieve<ReportQueryResult>(`/reports/query/${toQ(params)}`),
  abc: (params: QueryParams) => retrieve<AbcResult>(`/reports/abc/${toQ(params)}`),
  profit: (params?: QueryParams) =>
    retrieve<ProfitReport>(`/reports/profit/${toQ(params)}`),
  exportBlob: async (params: QueryParams): Promise<Blob> => {
    const resp = await api.get(`/reports/export/${toQ(params)}`, {
      responseType: 'blob',
    });
    return resp.data as Blob;
  },
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
