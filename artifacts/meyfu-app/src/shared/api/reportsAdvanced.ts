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

export const reportsAdvancedApi = {
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
