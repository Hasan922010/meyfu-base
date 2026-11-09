import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { db } from '@/offline/db';
import { MyOrdersPage } from './MyOrdersPage';

vi.mock('@/offline/useSync', () => ({
  useSync: () => ({ online: true, pending: 0 }),
}));

const mockFulfillOrderLocal = vi.fn((_id: unknown) => Promise.resolve('test-uuid-fulfill'));
vi.mock('@/offline/actions', () => ({
  fulfillOrderLocal: (id: unknown) => mockFulfillOrderLocal(id),
}));

function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyOrdersPage — Yetkazish (FulfillScreen) Ergonomik Boshqaruvi', () => {
  beforeEach(async () => {
    mockFulfillOrderLocal.mockClear();
    await db.orders.clear();

    await db.orders.add({
      id: 'ord-1',
      number: 'ORD-101',
      client: 'client-1',
      client_name: 'Afrosiyob Supermarket',
      status: 'APPROVED',
      status_display: 'Tasdiqlangan',
      payment_intent: 'NAQD',
      total_amount: '150000',
      taken_by_name: 'Aziz',
      items: [
        {
          id: 'item-1',
          product: 'prod-1',
          product_name: 'Kungaboqar Yog‘i 1L',
          quantity: '5',
          delivered_quantity: '0',
          price: '30000',
        },
      ],
    });
  });

  it('yetkazish tanlanganda tovarlar, miqdor boshqaruvi va 1-bosishda to‘lov tugmalari ishlaydi', async () => {
    renderWithClient(<MyOrdersPage />);

    // 1. Yetkazish ro'yxatida buyurtmani topish va bosish
    const orderBtn = await screen.findByRole('button', { name: /Afrosiyob Supermarket/ });
    expect(screen.getByText('ORD-101 · 1 tovar · zakaz: Aziz')).toBeInTheDocument();
    fireEvent.click(orderBtn);

    // 2. Yetkazish ekrani ochilishi
    expect(screen.getByRole('heading', { name: 'Yetkazish' })).toBeInTheDocument();
    expect(screen.getByText('Kungaboqar Yog‘i 1L')).toBeInTheDocument();
    expect(screen.getByText('buyurtma: 5 ta')).toBeInTheDocument();

    // 3. Yetkazilgan miqdorni kamaytirish va ko'paytirish tugmalari
    const decBtn = screen.getByRole('button', { name: 'Kungaboqar Yog‘i 1L — kamaytirish' });
    fireEvent.click(decBtn);
    const qtyInput = screen.getByRole('spinbutton', { name: 'Kungaboqar Yog‘i 1L yetkazilgan miqdor' });
    expect(qtyInput).toHaveValue(4);

    const incBtn = screen.getByRole('button', { name: "Kungaboqar Yog‘i 1L — ko'paytirish" });
    fireEvent.click(incBtn);
    expect(qtyInput).toHaveValue(5);

    // 4. "Hammasi (5)" tugmasi
    const allBtn = screen.getByRole('button', { name: 'Hammasi (5)' });
    fireEvent.click(allBtn);
    expect(qtyInput).toHaveValue(5);

    // 5. Naqd pul tugmasi bilan yetkazishni saqlash
    const cashBtn = screen.getByRole('button', { name: /Naqd pul · 150 000/ });
    fireEvent.click(cashBtn);

    await waitFor(() => {
      expect(mockFulfillOrderLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 'ord-1',
          client_name: 'Afrosiyob Supermarket',
          payment_type: 'NAQD',
          lines: [
            expect.objectContaining({
              delivered_quantity: 5,
              price: 30000,
            }),
          ],
        }),
      );
    });

    // 6. Muvaffaqiyatli saqlangach ekranda tasdiq ko'rinishi
    expect(await screen.findByRole('heading', { name: 'Yetkazildi' })).toBeInTheDocument();
  });
});
