import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { db } from '@/offline/db';
import { NewSalePage } from './NewSalePage';

vi.mock('@/offline/useSync', () => ({
  useSync: () => ({ online: true, pending: 0 }),
}));

const mockSaveSaleLocal = vi.fn((_payload: unknown) => Promise.resolve('test-uuid-sale'));
vi.mock('@/offline/actions', () => ({
  saveSaleLocal: (payload: unknown) => mockSaveSaleLocal(payload),
}));

vi.mock('@/shared/api/warehouse', () => ({
  warehouseApi: {
    myTodayLoadings: vi.fn(() => Promise.resolve([])),
  },
}));

function renderWithClient(ui: React.ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NewSalePage — Mobil Sotuv va Ergonomik To‘lov Oqimi', () => {
  beforeEach(async () => {
    mockSaveSaleLocal.mockClear();
    await db.clients.clear();
    await db.products.clear();
    await db.van_stock.clear();

    await db.clients.add({
      id: 'c1',
      name: 'Guliston Savdo Do‘koni',
      owner_name: 'Bobur',
      phone: '+998901112233',
      address: 'Markaziy ko‘cha 45',
      route: null,
      debt_limit: '10000000',
      current_debt: '1500000',
      is_blocked: false,
    });

    await db.products.add({
      id: 'p1',
      name: 'Toza Gel 1L',
      sku: 'GEL-1L',
      barcode: '998877',
      unit: 'dona',
      wholesale_price: '20000',
      retail_price: '25000',
      cost_price: '16000',
      min_price: '18000',
      pack_quantity: '12',
      package_type: 'karopka',
      is_active: true,
      image_thumb: null,
    });

    await db.van_stock.add({
      product: 'p1',
      product_name: 'Toza Gel 1L',
      product_sku: 'GEL-1L',
      unit: 'dona',
      quantity: 50,
    });
  });

  it('mijoz tanlangach, qadoq ma’lumoti ko‘rinadi va tovar savatga qo‘shiladi', async () => {
    renderWithClient(<NewSalePage />);

    // 1. Mijozni tanlash
    const clientBtn = await screen.findByRole('button', { name: /Guliston Savdo Do‘koni/ });
    expect(screen.getByText(/1 500 000.*qarz/)).toBeInTheDocument();
    fireEvent.click(clientBtn);

    // 2. Tovar va qadoq ma'lumoti ko'rinishi
    expect(await screen.findByText('Toza Gel 1L')).toBeInTheDocument();
    expect(screen.getByText('1 karopka = 12 dona')).toBeInTheDocument();
    expect(screen.getByText('50 dona qoldi')).toBeInTheDocument();

    // 3. Tovarga bosib savatga 1 dona qo'shish
    const addProductBtn = screen.getByRole('button', { name: /Toza Gel 1L — 1 ta qo'shish/ });
    fireEvent.click(addProductBtn);

    // 4. Pastdagi panelda jami summa va Naqd tugmasi
    expect(screen.getByText('Jami summa')).toBeInTheDocument();
    expect(screen.getByText('1 dona tovar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Naqd · 20 000/ })).toBeInTheDocument();
  });

  it('boshqa to‘lov bosilganda ergonomik to‘lov turlari va qarz muddati tezkor chiplari chiqadi', async () => {
    renderWithClient(<NewSalePage />);

    // 1. Mijoz tanlash
    const clientBtn = await screen.findByRole('button', { name: /Guliston Savdo Do‘koni/ });
    fireEvent.click(clientBtn);

    // 2. Tovarni savatga qo'shish
    const addProductBtn = await screen.findByRole('button', { name: /Toza Gel 1L — 1 ta qo'shish/ });
    fireEvent.click(addProductBtn);

    // 3. Boshqa to'lovga o'tish
    const otherPayBtn = screen.getByRole('button', { name: "Boshqa to'lov" });
    fireEvent.click(otherPayBtn);

    // 4. To'lov variantlari ko'rinishi
    expect(screen.getByRole('button', { name: /Naqd pul bilan to'lash/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plastik karta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Qarzga berish/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aralash/ })).toBeInTheDocument();

    // 5. Qarzga berish bosilganda tezkor kun chiplari ko'rinishi
    const qarzBtn = screen.getByRole('button', { name: /Qarzga berish/ });
    fireEvent.click(qarzBtn);

    expect(screen.getByRole('button', { name: '+7 kun' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+14 kun' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+30 kun' })).toBeInTheDocument();

    // 6. +7 kun chipini bosish
    fireEvent.click(screen.getByRole('button', { name: '+7 kun' }));

    // 7. Tasdiqlash bosilganda saveSaleLocal chaqiriladi
    const confirmBtn = screen.getByRole('button', { name: 'Tasdiqlash' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSaveSaleLocal).toHaveBeenCalledWith(
        expect.objectContaining({
          client: 'c1',
          payment_type: 'QARZ',
          lines: [
            expect.objectContaining({
              product: 'p1',
              quantity: 1,
              price: 20000,
            }),
          ],
        }),
      );
    });
  });

  it('aksiyali tovar xarid qilinganda avtomatik bepul aksiya bonusi qo‘shiladi va saqlanadi', async () => {
    // p1 mahsulotiga aksiya qo'shamiz: 10 ta olinsa -> 1 ta sovg'a
    await db.products.update('p1', {
      has_bonus: true,
      bonus_trigger_qty: 10,
      bonus_reward_qty: 1,
      bonus_product: 'p1',
      bonus_product_name: 'Toza Gel 1L',
    });

    renderWithClient(<NewSalePage />);

    // 1. Mijoz tanlash
    const clientBtn = await screen.findByRole('button', { name: /Guliston Savdo Do‘koni/ });
    fireEvent.click(clientBtn);

    // 2. Qadoq modalini ochish va 1 karopka (12 dona) tanlash
    const packBtn = await screen.findByTitle('Qadoqda kiritish uchun bosing');
    fireEvent.click(packBtn);

    // Modalda tasdiqlash
    const savePackBtn = screen.getByRole('button', { name: /Savatga qo'shish · 240 000/ });
    fireEvent.click(savePackBtn);

    // 3. Aksiya bonusi banneri paydo bo'lganini tekshirish
    expect(await screen.findByText('Aksiya bonusi (Mijozga bepul beriladi):')).toBeInTheDocument();
    expect(screen.getByText('+1 dona Toza Gel 1L')).toBeInTheDocument();
    expect(screen.getByText("«Toza Gel 1L» xaridi uchun")).toBeInTheDocument();

    // 4. Naqd to'lov bilan saqlash
    const payBtn = screen.getByRole('button', { name: /Naqd · 240 000/ });
    fireEvent.click(payBtn);

    // 5. saveSaleLocal'ga bonus qatori 0 so'm va is_bonus: true bilan borganini tekshirish
    await waitFor(() => expect(mockSaveSaleLocal).toHaveBeenCalledTimes(1));
    const saved = mockSaveSaleLocal.mock.calls[0]?.[0] as {
      client: string;
      payment_type: string;
      lines: Array<{ product: string; quantity: number; price: number; is_bonus?: boolean }>;
    };
    expect(saved.client).toBe('c1');
    expect(saved.payment_type).toBe('NAQD');
    expect(saved.lines).toHaveLength(2);
    expect(saved.lines[0]).toMatchObject({
      product: 'p1',
      quantity: 12,
      price: 20000,
      is_bonus: false,
    });
    expect(saved.lines[1]).toMatchObject({
      product: 'p1',
      quantity: 1,
      price: 0,
      is_bonus: true,
    });
  });
});
