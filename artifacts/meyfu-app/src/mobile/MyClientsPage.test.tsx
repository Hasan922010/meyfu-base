import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientsApi = vi.hoisted(() => ({
  list: vi.fn(),
  recordAdvance: vi.fn(),
}));

vi.mock('@/shared/api/clients', () => ({ clientsApi }));
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: 'WAREHOUSE' } }),
}));
vi.mock('./CheckInSheet', () => ({ CheckInSheet: () => null }));
vi.mock('./NewClientModal', () => ({ NewClientModal: () => null }));

import { MyClientsPage } from './MyClientsPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MyClientsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clientsApi.list.mockResolvedValue({
    results: [
      {
        id: 'cl-1',
        name: 'Baraka Market',
        owner_name: 'Anvar',
        phone: '+998901112233',
        address: 'Chilonzor',
        current_debt: '0.00',
        advance_balance: '50000.00',
        is_blocked: false,
      },
    ],
  });
  clientsApi.recordAdvance.mockResolvedValue({
    id: 'cl-1',
    advance_balance: '150000.00',
  });
});

describe('MyClientsPage — omborchi uchun ortiqcha to‘lov (avans)', () => {
  it('mijoz avansini ko‘rsatadi va yangi avans yozadi', async () => {
    renderPage();

    expect(await screen.findByText('Baraka Market')).toBeInTheDocument();
    expect(screen.getByText(/Avans: 50 000 so'm/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ortiqcha to'lov \(avans\)/ }));
    expect(
      await screen.findByText("Ortiqcha to'lov (avans): Baraka Market"),
    ).toBeInTheDocument();

    const amountInput = screen.getByLabelText('Avans summasi');
    fireEvent.change(amountInput, { target: { value: '100000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Avansni saqlash' }));

    await waitFor(() => {
      expect(clientsApi.recordAdvance).toHaveBeenCalledWith('cl-1', {
        amount: '100000',
        payment_type: 'NAQD',
      });
    });
  });
});
