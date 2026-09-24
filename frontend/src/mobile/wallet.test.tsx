import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { AxiosError } from 'axios';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { my, myTransactions } = vi.hoisted(() => ({ my: vi.fn(), myTransactions: vi.fn() }));
vi.mock('@/shared/api/finance', () => ({ walletApi: { my, myTransactions } }));

import { WalletCard } from './WalletCard';
import { WalletPage } from './WalletPage';

function renderWithClient(ui: ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const WALLET = {
  live_balance: '4978000.00',
  balance: '4978000.00',
  pending_expense_amount: '0.00',
};

beforeEach(() => {
  my.mockReset();
  myTransactions.mockReset().mockResolvedValue([]);
});

describe('Hamyon xato holati (UX audit)', () => {
  it('karta: yuklab bo‘lmasa "0 so‘m" emas, xabar ko‘rsatadi', async () => {
    my.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    renderWithClient(<WalletCard />);

    expect(await screen.findByText(/Balansni yuklab bo'lmadi/)).toBeInTheDocument();
    expect(screen.queryByText("0 so'm")).not.toBeInTheDocument();
  });

  it('karta: muvaffaqiyatda summani ko‘rsatadi', async () => {
    my.mockResolvedValue(WALLET);

    renderWithClient(<WalletCard />);

    expect(await screen.findByText("4 978 000 so'm")).toBeInTheDocument();
  });

  it('sahifa: xato bo‘lsa sabab va "Qayta urinish" tugmasi, nol raqamlar yo‘q', async () => {
    my.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    renderWithClient(<WalletPage />);

    expect(await screen.findByText(/Balansni yuklab bo'lmadi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qayta urinish' })).toBeInTheDocument();
    expect(screen.queryByText("0 so'm")).not.toBeInTheDocument();
    expect(screen.queryByText(/−0 so'm/)).not.toBeInTheDocument();
  });

  it('sahifa: tasdiqlanmagan xarajat 0 bo‘lsa "−0 so‘m" qatori chiqmaydi', async () => {
    my.mockResolvedValue(WALLET);

    renderWithClient(<WalletPage />);

    expect(await screen.findAllByText("4 978 000 so'm")).not.toHaveLength(0);
    expect(screen.queryByText('Tasdiqlanmagan xarajat')).not.toBeInTheDocument();
  });
});
