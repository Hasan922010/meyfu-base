import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const debtsApi = vi.hoisted(() => ({
  myRoute: vi.fn(),
}));
const saveDebtPaymentLocal = vi.hoisted(() => vi.fn(() => Promise.resolve('op-uuid')));

vi.mock('@/shared/api/debts', () => ({ debtsApi }));
vi.mock('@/offline/actions', () => ({ saveDebtPaymentLocal }));
vi.mock('@/offline/useSync', () => ({ useSync: () => ({ online: true, pending: 0 }) }));

import { DebtCollectPage } from './DebtCollectPage';

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DebtCollectPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  debtsApi.myRoute.mockResolvedValue([
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
      due_date: null,
      status: 'ACTIVE',
      status_display: 'Faol',
      created_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 'd2',
      client: 'c2',
      client_name: 'Omad Market',
      client_phone: '+998902220002',
      sale: 's2',
      sale_number: 'SOT-0002',
      amount: '250000',
      paid_amount: '0',
      remaining: '250000',
      due_date: '2026-11-20',
      status: 'ACTIVE',
      status_display: 'Faol',
      created_at: '2026-10-02T10:00:00Z',
    },
  ]);
});

describe('DebtCollectPage — telefon orqali farqlash va qidirish', () => {
  it("bir xil nomli qarzdorlarni telefon bilan ajratib ko'rsatadi, filtrlaydi va to'lov yozadi", async () => {
    renderPage();

    expect(await screen.findByText('+998901110001')).toBeInTheDocument();
    expect(screen.getByText('+998902220002')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Qarzdor qidirish'), {
      target: { value: '90 222 00 02' },
    });
    expect(screen.queryByText('+998901110001')).not.toBeInTheDocument();
    expect(screen.getByText('+998902220002')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Omad Market.*\+998902220002/ }));
    expect(await screen.findByText('Qarz: Omad Market (+998902220002)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "To'lovni qabul qilish" }));
    await waitFor(() =>
      expect(saveDebtPaymentLocal).toHaveBeenCalledWith({
        debt: 'd2',
        client_name: 'Omad Market',
        client_phone: '+998902220002',
        amount: 250000,
        payment_type: 'NAQD',
      }),
    );
  });
});

