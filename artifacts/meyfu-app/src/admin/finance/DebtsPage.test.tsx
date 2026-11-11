import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const debtsApi = vi.hoisted(() => ({
  list: vi.fn(),
  myRoute: vi.fn(),
}));
const financeApi = vi.hoisted(() => ({
  debtAging: vi.fn(),
}));

vi.mock('@/shared/api/debts', () => ({ debtsApi }));
vi.mock('@/shared/api/finance2', () => ({ financeApi }));

import { DebtsPage } from './DebtsPage';

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DebtsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  financeApi.debtAging.mockResolvedValue({
    as_of: '2026-11-11',
    total_outstanding: '300000',
    overdue_total: '300000',
    buckets: { current: '0', d1_30: '300000', d31_60: '0', d61_90: '0', d90_plus: '0' },
    overdue_clients: [
      { client_id: 'c1', client: 'Omad Market', phone: '+998901110001', amount: '100000', max_days: 12 },
      { client_id: 'c2', client: 'Omad Market', phone: '+998902220002', amount: '200000', max_days: 10 },
    ],
  });
  debtsApi.list.mockResolvedValue({
    count: 2,
    pages: 1,
    results: [
      {
        id: 'd1',
        client: 'c1',
        client_name: 'Omad Market',
        client_phone: '+998901110001',
        sale: null,
        sale_number: null,
        amount: '100000',
        paid_amount: '0',
        remaining: '100000',
        due_date: '2026-11-01',
        status: 'OVERDUE',
        status_display: "Muddati o'tgan",
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'd2',
        client: 'c2',
        client_name: 'Omad Market',
        client_phone: '+998902220002',
        sale: null,
        sale_number: null,
        amount: '200000',
        paid_amount: '0',
        remaining: '200000',
        due_date: '2026-11-02',
        status: 'OVERDUE',
        status_display: "Muddati o'tgan",
        created_at: '2026-10-02T10:00:00Z',
      },
    ],
  });
});

describe('DebtsPage — bir xil nomli mijozlarni telefon orqali farqlash', () => {
  it("bir xil nomli qarzdorlarni alohida telefon raqami bilan ko'rsatadi va telefon bo'yicha qidiradi", async () => {
    renderPage();

    expect(await screen.findAllByText('Omad Market')).toHaveLength(4);
    expect(screen.getAllByText('+998901110001')).toHaveLength(2);
    expect(screen.getAllByText('+998902220002')).toHaveLength(2);

    const searchInput = screen.getByLabelText('Qarzlarni qidirish');
    fireEvent.change(searchInput, { target: { value: '90 222-00-02' } });

    await waitFor(() =>
      expect(debtsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '902220002', page: 1 }),
      ),
    );
  });
});

