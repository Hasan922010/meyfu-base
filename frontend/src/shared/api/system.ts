import { api } from '@/shared/api/client';
import { postAction, retrieve } from '@/shared/api/crud';
import type { ApiSuccess } from '@/shared/types/api';

export interface IntegrityMismatch {
  kind: 'wallet' | 'stock' | 'van_stock' | 'cash_account' | 'order_total';
  id: string;
  label: string;
  stored: string;
  ledger: string;
  diff: string;
}

export interface IntegrityResult {
  ok: boolean;
  checked_at: string;
  counts: {
    wallets: number;
    stocks: number;
    van_stocks: number;
    cash_accounts: number;
    orders?: number;
  };
  mismatch_count: number;
  mismatches: IntegrityMismatch[];
}

export type CleanupLedgerKey =
  | 'finance.cashtransaction'
  | 'wallet.wallettransaction'
  | 'warehouse.suppliertransaction'
  | 'warehouse.stockmovement';

export interface SystemSettings {
  allow_test_cleanup: boolean;
}

export interface TestCleanupEntry {
  id: string;
  date: string;
  created_at: string;
  type_code: string;
  type_display: string;
  target_name: string;
  counterparty: string;
  amount: string;
  balance_after: string;
  reference_type: string;
  reference_id: string;
  note: string;
  actor_name: string;
}

export interface TestCleanupEntriesResponse {
  ledger: CleanupLedgerKey;
  allow_test_cleanup: boolean;
  entries: TestCleanupEntry[];
}

export interface TestCleanupRowSnapshot {
  model: string;
  id: string;
  label: string;
  fields: Record<string, unknown>;
}

export interface TestCleanupEffectChange {
  field: string;
  field_name: string;
  old: string;
  new: string;
}

export interface TestCleanupEffect {
  model: string;
  id: string;
  label: string;
  changes: TestCleanupEffectChange[];
}

export interface TestCleanupPreviewResponse {
  ledger: CleanupLedgerKey;
  selected_ids: string[];
  rows: TestCleanupRowSnapshot[];
  effects: TestCleanupEffect[];
  digest: string;
  cleanup_token: string;
}

export interface TestCleanupExecuteInput {
  ledger: CleanupLedgerKey;
  ids: string[];
  cleanup_token: string;
  reason: string;
  confirmation: string;
  password: string;
  acknowledged: boolean;
}

export interface TestCleanupExecuteResponse {
  cleaned_count: number;
  message: string;
}

interface DiskCheck {
  ok: boolean;
  free_percent: number | null;
  free_gb: number | null;
}

interface CeleryCheck {
  ok: boolean | null;
  workers: number | null;
}

export interface SystemStatus {
  generated_at: string;
  health: {
    status: 'ok' | 'degraded';
    healthy: boolean;
    checks: { db: boolean; redis: boolean; disk: DiskCheck; celery: CeleryCheck };
    queue_length: number | null;
    response_ms: number;
  };
  integrity: {
    ran_at: string | null;
    ok: boolean | null;
    mismatch_count: number | null;
    mismatches?: IntegrityMismatch[];
  };
  backup: {
    status: 'ok' | 'stale' | 'unknown';
    last_at: string | null;
    age_hours: number | null;
    size_mb: number | null;
    count: number;
  };
  sync: {
    conflicts: number;
    flagged: number;
    unsynced: number;
    last_sale_at: string | null;
  };
  ocr: {
    configured: boolean;
    needs_review: number;
    processing: number;
    failed_7d: number;
  };
  sentry_enabled: boolean;
}

export const systemApi = {
  /** `deep=false` — celery ping'siz tezkor javob (audit m8) */
  status: (deep = true) =>
    retrieve<SystemStatus>(`/system/status/${deep ? '' : '?deep=0'}`),
  integrityCheck: () => retrieve<IntegrityResult>('/system/integrity/'),
  integrityFix: () =>
    postAction<IntegrityResult & { fixed_count: number }>('/system/integrity/'),
  getSettings: () => retrieve<SystemSettings>('/system/settings/'),
  updateSettings: (body: Partial<SystemSettings>) =>
    api
      .patch<ApiSuccess<SystemSettings>>('/system/settings/', body)
      .then((r) => r.data.data),
  cleanupEntries: (ledger: CleanupLedgerKey, limit = 50) =>
    retrieve<TestCleanupEntriesResponse>(
      `/system/test-cleanup/entries/?ledger=${encodeURIComponent(ledger)}&limit=${limit}`,
    ),
  cleanupPreview: (body: { ledger: CleanupLedgerKey; ids: string[] }) =>
    postAction<TestCleanupPreviewResponse>('/system/test-cleanup/preview/', body),
  cleanupExecute: (body: TestCleanupExecuteInput) =>
    postAction<TestCleanupExecuteResponse>('/system/test-cleanup/execute/', body),
};
