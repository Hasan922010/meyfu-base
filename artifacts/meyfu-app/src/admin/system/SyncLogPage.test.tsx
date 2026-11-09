import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SyncLogPage } from './SyncLogPage';

vi.mock('@/shared/api/crud', () => ({
  listPage: vi.fn(() =>
    Promise.resolve({
      count: 2,
      results: [
        {
          id: 'log-1',
          created_at: '2026-11-09T10:00:00Z',
          user_name: 'Alisher Karimov',
          device_id: 'device-abc-123',
          operations_count: 5,
          conflicts_count: 0,
          errors_count: 0,
          duration_ms: 250,
        },
        {
          id: 'log-2',
          created_at: '2026-11-09T10:30:00Z',
          user_name: 'Bobur Mirzayev',
          device_id: 'device-xyz-789',
          operations_count: 12,
          conflicts_count: 1,
          errors_count: 0,
          duration_ms: 1200,
        },
      ],
    }),
  ),
}));

function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('SyncLogPage', () => {
  it('sinxronizatsiya yozuvlari va foydalanuvchilarni to‘g‘ri ko‘rsatadi', async () => {
    renderWithClient(<SyncLogPage />);

    expect(screen.getByText('Sinxronizatsiya jurnali')).toBeInTheDocument();
    expect(await screen.findByText('Alisher Karimov')).toBeInTheDocument();
    expect(screen.getByText('Bobur Mirzayev')).toBeInTheDocument();
    expect(screen.getByText('device-abc-123')).toBeInTheDocument();
  });
});
