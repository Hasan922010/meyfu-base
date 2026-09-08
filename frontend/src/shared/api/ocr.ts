import { api } from '@/shared/api/client';
import { listPage, postAction, retrieve, type QueryParams } from '@/shared/api/crud';
import type { ApiSuccess } from '@/shared/types/api';

export type ScanStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED';

export type MatchStatus = 'EXACT' | 'FUZZY' | 'NEW' | 'UNMATCHED';

export interface ScanLine {
  id: string;
  line_number: number;
  raw_name: string;
  raw_quantity: string;
  raw_unit: string;
  raw_price: string;
  raw_amount: string;
  matched_product: string | null;
  matched_product_name: string | null;
  match_confidence: number;
  match_status: MatchStatus;
  match_status_display: string;
  final_product: string | null;
  final_product_name: string | null;
  final_quantity: string | null;
  final_price: string | null;
  low_confidence: boolean;
  was_corrected: boolean;
  is_confirmed: boolean;
}

export interface ScanPage {
  id: string;
  image: string;
  processed_image: string | null;
  page_number: number;
}

export interface InvoiceScan {
  id: string;
  uploaded_by_name: string;
  warehouse: string;
  supplier: string | null;
  scan_type: string;
  status: ScanStatus;
  status_display: string;
  detected_invoice_number: string;
  detected_date: string | null;
  detected_total: string | null;
  detected_supplier_name: string;
  confidence: string;
  provider: string;
  tokens_used: number;
  cost_usd: string;
  processing_time_ms: number;
  error_message: string;
  purchase: string | null;
  line_count: number;
  pages: ScanPage[];
  lines: ScanLine[];
  created_at: string;
}

export interface OcrMetrics {
  period_days: number;
  scans_total: number;
  scans_confirmed: number;
  scans_failed: number;
  line_accuracy_pct: number;
  correction_rate_pct: number;
  total_lines: number;
  avg_cost_per_scan_usd: string;
  total_cost_usd: string;
  avg_tokens_per_scan: number;
  avg_time_to_confirm_sec: number;
  manual_fallback_pct: number;
  match_breakdown: Record<string, number>;
  decision: 'OCR_WORKING' | 'PREFER_MANUAL' | 'INSUFFICIENT_DATA';
  cost_limit: {
    daily_used_usd: string;
    daily_limit_usd: string;
    monthly_used_usd: string;
    monthly_limit_usd: string;
  };
}

export const ocrApi = {
  list: (params?: QueryParams) => listPage<InvoiceScan>('/invoice-scans/', params),
  get: (id: string) => retrieve<InvoiceScan>(`/invoice-scans/${id}/`),
  metrics: (days = 30) =>
    retrieve<OcrMetrics>(`/invoice-scans/metrics/?days=${days}`),

  upload: async (form: FormData): Promise<InvoiceScan> => {
    const { data } = await api.post<ApiSuccess<InvoiceScan>>(
      '/invoice-scans/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  reprocess: (id: string) => postAction<InvoiceScan>(`/invoice-scans/${id}/reprocess/`),
  confirm: (id: string) => postAction<InvoiceScan>(`/invoice-scans/${id}/confirm/`),
  cancel: (id: string) => postAction<InvoiceScan>(`/invoice-scans/${id}/cancel/`),
  updateHeader: (id: string, body: Record<string, unknown>) =>
    api
      .patch<ApiSuccess<InvoiceScan>>(`/invoice-scans/${id}/header/`, body)
      .then((r) => r.data.data),
  updateLine: (
    id: string,
    lineId: string,
    body: { final_product?: string | null; final_quantity?: string; final_price?: string },
  ): Promise<unknown> =>
    api
      .patch<unknown>(`/invoice-scans/${id}/lines/${lineId}/`, body)
      .then((r) => r.data),

  receiptScan: async (image: File): Promise<{
    total: string | null;
    date: string | null;
    supplier: string;
    provider: string;
  }> => {
    const form = new FormData();
    form.append('image', image);
    const { data } = await api.post<
      ApiSuccess<{ total: string | null; date: string | null; supplier: string; provider: string }>
    >('/receipt-scan/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },
};
