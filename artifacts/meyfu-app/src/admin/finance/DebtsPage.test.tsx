import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const debtsApi = vi.hoisted(() => ({
  list: vi.fn(),
  byClient: vi.fn(),
  myRoute: vi.fn(),
  listPayments: vi.fn(),
  cancelPayment: vi.fn(),
}));
const financeApi = vi.hoisted(() => ({
  debtAging: vi.fn(),
}));
const authApi = vi.hoisted(() => ({
  staff: vi.fn(),
}));

vi.mock('@/shared/api/debts', () => ({ debtsApi }));
vi.mock('@/shared/api/finance2', () => ({ financeApi }));
vi.mock('@/shared/api/users', () => ({ authApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string; is_superuser: boolean } }) => unknown) =>
    sel({ user: { role: 'SUPER_ADMIN', is_superuser: true } }),
}));

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
  authApi.staff.mockResolvedValue([
    { id: 'u1', full_name: 'Ali Tarqatuvchi', role: 'DISTRIBUTOR' },
    { id: 'u2', full_name: 'Vali Zakazchi', role: 'ORDER_TAKER' },
  ]);
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
  debtsApi.byClient.mockResolvedValue({
    count: 2,
    pages: 1,
    results: [
      {
        client: 'c1',
        client_name: 'Omad Market',
        client_phone: '+998901110001',
        debt_count: 2,
        amount: '100000',
        paid_amount: '0',
        remaining: '100000',
        due_date: '2026-11-01',
        status: 'OVERDUE',
        status_display: "Muddati o'tgan",
        primary_debt_id: 'd1',
      },
      {
        client: 'c2',
        client_name: 'Omad Market',
        client_phone: '+998902220002',
        debt_count: 1,
        amount: '200000',
        paid_amount: '0',
        remaining: '200000',
        due_date: '2026-11-02',
        status: 'OVERDUE',
        status_display: "Muddati o'tgan",
        primary_debt_id: 'd2',
      },
    ],
  });
  debtsApi.listPayments.mockResolvedValue({
    count: 0,
    pages: 1,
    results: [],
  });
  debtsApi.cancelPayment.mockResolvedValue({ id: 'pay-new' });
});

describe('DebtsPage — bir xil nomli mijozlarni telefon orqali farqlash', () => {
  it("bir xil nomli qarzdorlarni alohida telefon raqami bilan ko'rsatadi va telefon bo'yicha qidiradi", async () => {
    renderPage();

    expect(await screen.findAllByText('Omad Market')).toHaveLength(2);
    expect(screen.getByText('+998901110001')).toBeInTheDocument();
    expect(screen.getByText('+998902220002')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Barcha qarzlar' }));
    expect(await screen.findAllByText('Omad Market')).toHaveLength(2);

    const searchInput = screen.getByLabelText('Qarzlarni qidirish');
    fireEvent.change(searchInput, { target: { value: '90 222-00-02' } });

    await waitFor(() =>
      expect(debtsApi.byClient).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '902220002', page: 1 }),
      ),
    );
  });

  it("SuperAdmin 24 soat ichidagi qarz to'lovini bekor qila oladi, eskisi bloklanadi", async () => {
    debtsApi.listPayments.mockResolvedValueOnce({
      count: 2,
      pages: 1,
      results: [
        {
          id: 'pay-new',
          debt: 'd1',
          client_name: 'Omad Market',
          client_phone: '+998901110001',
          amount: '50000',
          payment_type: 'NAQD',
          collected_by: 'u1',
          collected_by_name: 'Ali',
          date: '2026-11-21',
          note: 'Xato summa',
          created_at: new Date().toISOString(),
        },
        {
          id: 'pay-old',
          debt: 'd2',
          client_name: 'Omad Market',
          client_phone: '+998902220002',
          amount: '30000',
          payment_type: 'NAQD',
          collected_by: 'u1',
          collected_by_name: 'Ali',
          date: '2026-11-19',
          note: '',
          created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
        },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: "Qarz to'lovlari" }));
    expect(await screen.findByText('Xato summa')).toBeInTheDocument();
    expect(screen.getByText("24 soat o'tgan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    expect(
      await screen.findByText(/50 000 so'm to'lovini bekor qilsangiz/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ha, bekor qilish' }));

    await waitFor(() => {
      expect(debtsApi.cancelPayment).toHaveBeenCalledWith('pay-new');
    });
  });

  it("xodim mijozlari bo'yicha filterlaganda jami qarzdorlik qayta hisoblanadi", async () => {
    financeApi.debtAging.mockImplementation((params?: { staff?: string }) =>
      Promise.resolve({
        as_of: '2026-11-11',
        total_outstanding: params?.staff === 'u1' ? '100000' : '300000',
        overdue_total: params?.staff === 'u1' ? '100000' : '300000',
        buckets: { current: '0', d1_30: '100000', d31_60: '0', d61_90: '0', d90_plus: '0' },
        overdue_clients: [],
      }),
    );

    renderPage();

    expect((await screen.findAllByText("300 000 so'm")).length).toBeGreaterThanOrEqual(1);
    const staffSelect = await screen.findByLabelText('Xodim mijozlari');
    await screen.findByRole('option', { name: 'Ali Tarqatuvchi' });

    fireEvent.change(staffSelect, { target: { value: 'u1' } });

    await waitFor(() => {
      expect(financeApi.debtAging).toHaveBeenCalledWith({ staff: 'u1' });
    });
    expect(await screen.findAllByText("100 000 so'm")).not.toHaveLength(0);
  });
});

