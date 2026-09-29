import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sync', () => ({ pushOutbox: vi.fn(() => Promise.resolve()) }));

import { saveSaleReturnLocal } from './actions';
import { db } from './db';

const LINE = { product: 'p1', product_name: 'Ariel 3kg', quantity: 2, price: 45000 };

beforeEach(async () => {
  await db.outbox.clear();
  await db.van_stock.clear();
  await db.van_stock.put({
    product: 'p1', product_name: 'Ariel 3kg', product_sku: 'A3', unit: 'dona', quantity: 5,
  });
});

describe('saveSaleReturnLocal — mijozdan qaytarish (B3)', () => {
  it("outbox'ga sale_return operatsiyasini yozadi", async () => {
    const uuid = await saveSaleReturnLocal({
      client: 'c1', client_name: 'Do‘kon', reason: 'BRAK', restock: true, lines: [LINE],
    });

    const op = await db.outbox.get(uuid);
    expect(op?.type).toBe('sale_return');
    expect(op?.payload).toMatchObject({
      client: 'c1', reason: 'BRAK', restock: true,
      items: [{ product: 'p1', quantity: '2', price: '45000' }],
    });
  });

  it('restock=true — mashina qoldig‘i lokal oshadi', async () => {
    await saveSaleReturnLocal({
      client: 'c1', client_name: 'Do‘kon', reason: 'MUDDAT', restock: true, lines: [LINE],
    });

    expect((await db.van_stock.get('p1'))?.quantity).toBe(7);
  });

  it('restock=false (brak) — qoldiq o‘zgarmaydi', async () => {
    await saveSaleReturnLocal({
      client: 'c1', client_name: 'Do‘kon', reason: 'BRAK', restock: false, lines: [LINE],
    });

    expect((await db.van_stock.get('p1'))?.quantity).toBe(5);
  });
});
