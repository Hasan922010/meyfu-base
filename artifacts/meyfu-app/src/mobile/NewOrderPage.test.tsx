import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { db } from '@/offline/db';
import { NewOrderPage } from './NewOrderPage';

vi.mock('@/offline/useSync', () => ({
  useSync: () => ({ online: true, pending: 0 }),
}));

vi.mock('@/offline/actions', () => ({
  saveOrderLocal: vi.fn(() => Promise.resolve('test-uuid')),
}));

describe('NewOrderPage — Qadoq va Dona hisob-kitobi', () => {
  beforeEach(async () => {
    await db.clients.clear();
    await db.products.clear();

    await db.clients.add({
      id: 'c1',
      name: 'Oqtepa Do‘koni',
      owner_name: 'Anvar aka',
      phone: '+998901234567',
      address: 'Chilonzor',
      route: null,
      debt_limit: '5000000',
      current_debt: '0',
      is_blocked: false,
    });

    await db.products.add({
      id: 'p1',
      name: 'Bio Kukun 3kg',
      sku: 'BIO-3KG',
      barcode: '123456789',
      unit: 'dona',
      wholesale_price: '25000',
      retail_price: '30000',
      cost_price: '20000',
      min_price: '0',
      pack_quantity: '12',
      package_type: 'karopka',
      is_active: true,
      image_thumb: null,
    });
  });

  it('qadoqli tovar tanlanganda Dona va Qadoq tanlovi chiqadi va qadoq bo‘yicha to‘g‘ri hisoblaydi', async () => {
    render(
      <MemoryRouter>
        <NewOrderPage />
      </MemoryRouter>,
    );

    // 1. Mijozni tanlash
    const clientBtn = await screen.findByRole('button', { name: 'Oqtepa Do‘koni' });
    fireEvent.click(clientBtn);

    // 2. Tovarni qidirish va tanlash
    const searchInput = screen.getByPlaceholderText('Tovar qidirish…');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    const productBtn = await screen.findByRole('button', { name: /Bio Kukun 3kg/ });
    fireEvent.click(productBtn);

    // 3. Dona va Qadoq tanlov tugmalari paydo bo‘lishi kerak
    expect(screen.getByRole('button', { name: 'Dona (dona)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Qadoq \(karopka — 12 dona\)/ })).toBeInTheDocument();

    // 4. Qadoq miqdorini 10 qilib belgilash (masalan: 10 karopka)
    const quick10Btn = screen.getByRole('button', { name: '10' });
    fireEvent.click(quick10Btn);

    // 5. Hisoblash formulasi ekranda to‘g‘ri aks etishi: 10 karopka * 12 dona = 120 dona
    // 120 dona * 25 000 so'm = 3 000 000 so'm
    expect(screen.getByText(/10 karopka × 12 dona = 120 dona/)).toBeInTheDocument();
    expect(screen.getAllByText(/3 000 000/).length).toBeGreaterThanOrEqual(1);

    // 6. Savatga qo'shish
    const addBtn = screen.getByRole('button', { name: /Savatga qo'shish/ });
    fireEvent.click(addBtn);

    // 7. Savatda tovar qatori qadoq va dona soni bilan aniq ko‘rinishi kerak
    expect(screen.getByText(/10 karopka/)).toBeInTheDocument();
    expect(screen.getByText(/\(120 dona\)/)).toBeInTheDocument();
  });

  it('aksiyali tovar buyurtma qilinganda avtomatik bepul aksiya bonusi qo‘shiladi va saqlanadi', async () => {
    const { saveOrderLocal } = await import('@/offline/actions');

    await db.products.update('p1', {
      has_bonus: true,
      bonus_trigger_qty: 12,
      bonus_reward_qty: 1,
      bonus_product: 'p1',
      bonus_product_name: 'Bio Kukun 3kg',
    });

    render(
      <MemoryRouter>
        <NewOrderPage />
      </MemoryRouter>,
    );

    // 1. Mijoz tanlash
    const clientBtn = await screen.findByRole('button', { name: 'Oqtepa Do‘koni' });
    fireEvent.click(clientBtn);

    // 2. Tovarni qidirish va 1 karopka (12 dona) tanlash
    const searchInput = screen.getByPlaceholderText('Tovar qidirish…');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    const productBtn = await screen.findByRole('button', { name: /Bio Kukun 3kg/ });
    fireEvent.click(productBtn);

    const addBtn = screen.getByRole('button', { name: /Savatga qo'shish/ });
    fireEvent.click(addBtn);

    // 3. Aksiya bonusi banneri paydo bo'lishi
    expect(await screen.findByText("Aksiya bonusi (Buyurtmaga bepul qo'shiladi):")).toBeInTheDocument();
    expect(screen.getByText('+1 dona Bio Kukun 3kg')).toBeInTheDocument();

    // 4. Davom etish va buyurtmani saqlash
    const nextBtn = screen.getByRole('button', { name: 'Davom etish' });
    fireEvent.click(nextBtn);

    expect(screen.getByText('+1 ta bepul aksiya bonusi bilan')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Buyurtmani saqlash' });
    fireEvent.click(saveBtn);

    expect(saveOrderLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        client: 'c1',
        lines: expect.arrayContaining([
          expect.objectContaining({
            product: 'p1',
            quantity: 12,
            price: 25000,
            is_bonus: false,
          }),
          expect.objectContaining({
            product: 'p1',
            quantity: 1,
            price: 0,
            is_bonus: true,
          }),
        ]),
      }),
    );
  });
});
