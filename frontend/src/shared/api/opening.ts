import { postAction, retrieve } from '@/shared/api/crud';

/** Boshlang'ich qoldiqlar bo'limlari — backenddagi viewset yo'llari. */
export type OpeningKind = 'stock' | 'cash' | 'suppliers' | 'clients' | 'staff';

const BASE: Record<OpeningKind, string> = {
  stock: '/stock',
  cash: '/cash-transactions',
  suppliers: '/suppliers',
  clients: '/clients',
  staff: '/wallet',
};

export interface OpeningSheetRow {
  id: string;
  name: string;
  /** SKU yoki telefon — qidirish va ajratish uchun */
  code: string;
  current: string;
}

export interface OpeningBulkRow {
  id: string;
  /** Yakuniy qoldiq — farqni server hisoblaydi */
  target: string;
}

export interface OpeningBulkResult {
  applied: number;
  skipped: number;
}

export const openingApi = {
  sheet: (kind: OpeningKind, warehouse?: string) =>
    retrieve<OpeningSheetRow[]>(
      `${BASE[kind]}/opening-sheet/${warehouse ? `?warehouse=${warehouse}` : ''}`,
    ),
  bulk: (
    kind: OpeningKind,
    body: { rows: OpeningBulkRow[]; note?: string; warehouse?: string },
  ) => postAction<OpeningBulkResult>(`${BASE[kind]}/opening-balance/bulk/`, body),
};
