import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientsApi = vi.hoisted(() => ({ routes: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/shared/api/clients', () => ({ clientsApi }));

import { ToastContext } from '@/shared/lib/toast';
import type { Client } from '@/shared/types/clients';

import { ClientForm } from './ClientForm';

const push = vi.fn();
const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

function renderForm(client: Client | null = null): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastContext.Provider value={{ push }}>
        <ClientForm client={client} onDone={() => undefined} />
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Marshrutlar kechikib keladi — tahrirda marshrut bo'sh ko'rinmasligi kerak
  clientsApi.routes.mockImplementation(
    () => new Promise((r) => setTimeout(() => r(page([{ id: 'r1', name: 'Chilonzor' }])), 30)),
  );
  clientsApi.create.mockResolvedValue({ id: 'c1' });
});

describe('ClientForm (audit m2)', () => {
  it('bo‘sh qarz limiti yuborilmaydi (server 0 qo‘yadi) va xato bermaydi', async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText("Do'kon nomi *"), { target: { value: 'UX Test' } });
    fireEvent.change(screen.getByLabelText('Marshrut'), { target: { value: 'r1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(clientsApi.create).toHaveBeenCalled());
    expect(clientsApi.create.mock.calls[0]![0]).not.toHaveProperty('debt_limit');
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' })),
    );
  });

  it('marshrut tanlanmasa ogohlantiradi', async () => {
    renderForm();

    expect(await screen.findByText(/hech bir tarqatuvchiga ko‘rinmaydi/)).toBeInTheDocument();
  });

  it('tahrirda marshrutlar kechiksa ham mijozning marshruti tanlangan', async () => {
    renderForm({ id: 'c1', name: 'Baraka', route: 'r1', client_type: 'SHOP', debt_limit: '1000000.00' } as Client);

    await waitFor(() => expect(screen.getByLabelText('Marshrut')).toHaveValue('r1'));
  });
});
