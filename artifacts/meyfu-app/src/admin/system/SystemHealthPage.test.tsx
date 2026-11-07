import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const status = (celeryOk: boolean | null) => ({
  generated_at: '2026-09-24T10:00:00Z',
  health: {
    status: 'ok',
    healthy: true,
    checks: {
      db: true,
      redis: true,
      disk: { ok: true, free_percent: 13.7, free_gb: 28.3 },
      celery: { ok: celeryOk, workers: celeryOk ? 1 : null },
    },
    queue_length: null,
    response_ms: 5,
  },
  integrity: { ran_at: null, ok: null, mismatch_count: null, mismatches: [] },
  backup: { last_backup: null },
  sync: {},
  ocr: {},
  sentry_enabled: false,
});

const systemApi = vi.hoisted(() => ({
  status: vi.fn(),
  integrityCheck: vi.fn(),
  integrityFix: vi.fn(),
}));
vi.mock('@/shared/api/system', () => ({ systemApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'MANAGER' } }),
}));

import { SystemHealthPage } from './SystemHealthPage';

describe('SystemHealthPage (audit m8)', () => {
  it('celery ping kutilmasdan tezkor holat darhol chiziladi', async () => {
    // tezkor (deep=false) darhol, to'liq — hech qachon kelmaydi (sekin celery)
    systemApi.status.mockImplementation((deep?: boolean) =>
      deep === false ? Promise.resolve(status(null)) : new Promise(() => undefined),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <SystemHealthPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/Baza: ishlayapti/)).toBeInTheDocument();
    expect(screen.getByText(/Celery: tekshirilmoqda/)).toBeInTheDocument();
  });
});
