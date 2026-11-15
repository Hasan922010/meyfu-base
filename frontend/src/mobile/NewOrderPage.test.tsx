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

  it('buyurtmada dona narxida hisoblaydi va tezkor sonlar bosilganda qo‘shib boradi', async () => {
    render(
      <MemoryRouter>
        <NewOrderPage />
      </MemoryRouter>,
    );

    // 1. Mijozni tanlash
    const clientBtn = await screen.findByRole('button', { name: /Oqtepa Do‘koni/ });
    expect(screen.getByText(/\+998901234567/)).toBeInTheDocument();
    fireEvent.click(clientBtn);

    // 2. Tovarni qidirish va tanlash
    const searchInput = screen.getByPlaceholderText('Tovar qidirish…');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    const productBtn = await screen.findByRole('button', { name: /Bio Kukun 3kg/ });
    fireEvent.click(productBtn);

    // 3. Qadoq/dona almashtirish tugmalari chiqmasligi kerak, qadoqli tovar avtomatik karopkada hisoblanadi
    expect(screen.queryByRole('button', { name: 'Dona (dona)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Qadoq \(/ })).not.toBeInTheDocument();

    // 4. 3 bosilsa 3 karopka, yana 3 bosilsa 6 karopka (25 000 * 12 * 6 = 1 800 000)
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText(/3 karopka × 12 dona = 36 dona/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText(/6 karopka × 12 dona = 72 dona/)).toBeInTheDocument();
    expect(screen.getByText(/25 000 so'm × 12 × 6 =/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 800 000/).length).toBeGreaterThanOrEqual(1);

    // 5. Savatga qo'shish
    const addBtn = screen.getByRole('button', { name: /Savatga qo'shish/ });
    fireEvent.click(addBtn);

    // 6. Savatda qadoq va umumiy dona ko'rinishida chiqadi
    expect(screen.getByText(/6 karopka/)).toBeInTheDocument();
    expect(screen.getByText(/\(72 dona\)/)).toBeInTheDocument();
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
    const clientBtn = await screen.findByRole('button', { name: /Oqtepa Do‘koni/ });
    fireEvent.click(clientBtn);

    // 2. Tovarni qidirish va 1 karopka (12 dona) tanlash
    const searchInput = screen.getByPlaceholderText('Tovar qidirish…');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });

    const productBtn = await screen.findByRole('button', { name: /Bio Kukun 3kg/ });
    fireEvent.click(productBtn);

    // 1 karopka = 12 dona (bonus_trigger_qty: 12)
    fireEvent.click(screen.getByRole('button', { name: '1' }));

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

    const saved = vi.mocked(saveOrderLocal).mock.calls[0]?.[0];
    expect(saved?.client).toBe('c1');
    expect(saved?.lines).toHaveLength(2);
    expect(saved?.lines[0]).toMatchObject({
      product: 'p1',
      quantity: 12,
      price: 25000,
      is_bonus: false,
    });
    expect(saved?.lines[1]).toMatchObject({
      product: 'p1',
      quantity: 1,
      price: 0,
      is_bonus: true,
    });
  });
});
