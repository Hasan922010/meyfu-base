import { api } from '@/shared/api/client';
import { retrieve } from '@/shared/api/crud';
import type { PeriodParams } from '@/shared/api/reports360';

/** Filial faoliyati bo'limlari — backend `reports/services/branch.py` KINDS bilan bir xil */
export type BranchKind =
  | 'stock'
  | 'in_transit'
  | 'purchases'
  | 'transfers_in'
  | 'transfers_out'
  | 'loadings'
  | 'returns'
  | 'inventory'
  | 'write_offs'
  | 'opening'
  | 'other';

export interface BranchInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_branch: boolean;
  manager_name: string | null;
}

export interface BranchSummary extends BranchInfo {
  stock_quantity: string;
  stock_amount: string;
  in_transit_quantity: string;
  today_movements: number;
}

export interface BranchCard {
  kind: BranchKind;
  label: string;
  /** Hujjatlar soni (qoldiqda — tovar turlari soni) */
  count: number;
  /** Ishorali: musbat — kirim, manfiy — chiqim */
  quantity: string;
  amount: string;
  /** Oldingi davrga nisbatan % (summa bo'yicha) */
  change: number | null;
  low_count?: number;
}

export interface BranchCards {
  warehouse: BranchInfo;
  date_from: string;
  date_to: string;
  cards: BranchCard[];
}

export interface ActivityDocument {
  type: 'purchase' | 'loading' | 'inventory' | 'transfer' | 'daily_return';
  id: string;
  label: string;
  number: string;
}

export interface ActivityRow {
  id: string;
  date: string;
  product_name: string;
  product_sku: string;
  unit: string;
  quantity: string;
  amount: string;
  balance_after: string;
  movement_type: string;
  note: string;
  user_name: string;
  document: ActivityDocument | null;
}

export interface BranchActivity {
  warehouse: BranchInfo;
  kind: BranchKind;
  label: string;
  date_from: string;
  date_to: string;
  rows: ActivityRow[];
  truncated: boolean;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length
    ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
}

export const branchesApi = {
  list: () => retrieve<BranchSummary[]>('/reports/branches/'),
  cards: (id: string, p: PeriodParams) =>
    retrieve<BranchCards>(`/reports/branches/${id}/cards/${qs(p)}`),
  activity: (id: string, kind: BranchKind, p: PeriodParams) =>
    retrieve<BranchActivity>(`/reports/branches/${id}/activity/${qs({ ...p, kind })}`),
  exportBlob: async (id: string, kind: BranchKind, p: PeriodParams): Promise<Blob> => {
    const resp = await api.get(
      `/reports/export/${qs({ type: 'branch', branch: id, kind, fmt: 'xlsx', ...p })}`,
      { responseType: 'blob' },
    );
    return resp.data as Blob;
  },
};
