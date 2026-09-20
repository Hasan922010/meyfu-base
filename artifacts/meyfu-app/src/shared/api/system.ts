import { postAction, retrieve } from '@/shared/api/crud';

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
  status: () => retrieve<SystemStatus>('/system/status/'),
  integrityCheck: () => retrieve<IntegrityResult>('/system/integrity/'),
  integrityFix: () =>
    postAction<IntegrityResult & { fixed_count: number }>('/system/integrity/'),
};
