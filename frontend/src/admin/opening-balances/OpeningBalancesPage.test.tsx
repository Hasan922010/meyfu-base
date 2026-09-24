import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Har bir API funksiyasi bo'sh sahifa qaytaradi — test faqat ruxsat UI'sini tekshiradi
const emptyApi = vi.hoisted(
  () => () =>
    new Proxy(
      {},
      {
        get: () => () =>
          Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
      },
    ),
);
vi.mock('@/shared/api/catalog', () => ({ catalogApi: emptyApi() }));
vi.mock('@/shared/api/clients', () => ({ clientsApi: emptyApi() }));
vi.mock('@/shared/api/debts', () => ({ debtsApi: emptyApi() }));
vi.mock('@/shared/api/finance', () => ({ walletApi: emptyApi() }));
vi.mock('@/shared/api/finance2', () => ({ financeApi: emptyApi() }));
vi.mock('@/shared/api/users', () => ({ staffApi: emptyApi() }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi: emptyApi() }));

const auth = vi.hoisted(() => ({ role: 'ACCOUNTANT' }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: auth.role } }),
}));

import { OpeningBalancesPage } from './OpeningBalancesPage';

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OpeningBalancesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = 'ACCOUNTANT';
});

describe('OpeningBalancesPage — rolga qarab yozish (audit K3b)', () => {
  it('buxgalter formani ko‘rmaydi, faqat izoh va tarix', async () => {
    renderPage();

    expect(await screen.findByText(/Faqat ko‘rish/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saqlash' })).not.toBeInTheDocument();
  });

  it('menejer tovar qoldig‘ini kiritadi, kassani esa faqat ko‘radi', async () => {
    auth.role = 'MANAGER';
    renderPage();

    expect(await screen.findByRole('button', { name: 'Saqlash' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kassa' }));
    expect(await screen.findByText(/Faqat ko‘rish/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saqlash' })).not.toBeInTheDocument();
  });
});
