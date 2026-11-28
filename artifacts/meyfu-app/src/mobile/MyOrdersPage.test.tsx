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

const ordersApi = vi.hoisted(() => ({
  myToTake: vi.fn(),
  giveOnDebt: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/shared/api/orders', () => ({ ordersApi }));

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
    expect(screen.getByText('buyurtma: 5 dona')).toBeInTheDocument();

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

  it('Olganlarimda Ulashish o‘rniga Buyurtmani berish tugmasi chiqadi va qarzga beradi', async () => {
    ordersApi.myToTake.mockResolvedValue([
      {
        id: 'ord-taken-1',
        number: 'BUY-201',
        date: '2026-11-21',
        created_at: '2026-11-21T08:00:00Z',
        client: 'cl-1',
        client_name: 'Baraka Market',
        taken_by_name: 'Aziz',
        status: 'PLACED',
        status_display: 'Berilgan',
        payment_intent: 'QARZ',
        total_amount: '120000',
        items: [],
      },
    ]);
    ordersApi.giveOnDebt.mockResolvedValue({ id: 'ord-taken-1', status: 'DELIVERED' });

    renderWithClient(<MyOrdersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Olganlarim' }));
    expect(await screen.findByText('Baraka Market')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Ulashish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF saqlash' })).toBeInTheDocument();

    const giveBtns = screen.getAllByRole('button', { name: 'Buyurtmani berish' });
    fireEvent.click(giveBtns[0]!);

    expect(
      await screen.findByText(/120 000 so'm mijoz qarziga qo'shilsinmi\?/),
    ).toBeInTheDocument();

    const confirmBtns = screen.getAllByRole('button', { name: 'Buyurtmani berish' });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]!);

    await waitFor(() => {
      expect(ordersApi.giveOnDebt).toHaveBeenCalledWith('ord-taken-1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('Buyurtmani berish xatosini tasdiqlash oynasida ko‘rsatadi', async () => {
    ordersApi.myToTake.mockResolvedValue([
      {
        id: 'ord-taken-2',
        number: 'BUY-202',
        date: '2026-11-21',
        created_at: '2026-11-21T08:00:00Z',
        client: 'cl-1',
        client_name: 'Baraka Market',
        taken_by_name: 'Aziz',
        status: 'PLACED',
        status_display: 'Berilgan',
        payment_intent: 'QARZ',
        total_amount: '120000',
        items: [],
      },
    ]);
    ordersApi.giveOnDebt.mockRejectedValueOnce(new Error('Mijoz bloklangan'));

    renderWithClient(<MyOrdersPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Olganlarim' }));
    expect(await screen.findByText('Baraka Market')).toBeInTheDocument();

    const giveBtns = screen.getAllByRole('button', { name: 'Buyurtmani berish' });
    fireEvent.click(giveBtns[0]!);
    const confirmBtns = screen.getAllByRole('button', { name: 'Buyurtmani berish' });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Mijoz bloklangan');
  });
});
