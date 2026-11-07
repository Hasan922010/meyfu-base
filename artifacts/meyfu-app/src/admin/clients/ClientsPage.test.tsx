import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientsApi = vi.hoisted(() => ({ list: vi.fn(), routes: vi.fn(), remove: vi.fn() }));
vi.mock('@/shared/api/clients', () => ({ clientsApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'MANAGER' } }),
}));

import { ClientsPage } from './ClientsPage';

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

beforeEach(() => {
  vi.clearAllMocks();
  clientsApi.list.mockResolvedValue(
    page([{ id: 'c1', name: 'UX Test', phone: '', route_name: '', debt_limit: '0', current_debt: '0', is_blocked: false }]),
  );
  clientsApi.routes.mockResolvedValue(page([]));
  clientsApi.remove.mockResolvedValue(undefined);
});

describe('ClientsPage (audit p6)', () => {
  it('o‘chirishni brauzer confirm() emas, ilova oynasi orqali tasdiqlaydi', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ClientsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const row = (await screen.findByText('UX Test')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: "O'chirish" }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/UX Test/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: "O'chirish" }));

    await waitFor(() => expect(clientsApi.remove).toHaveBeenCalledWith('c1'));
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
});
