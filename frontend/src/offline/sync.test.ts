import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, myVanStock } = vi.hoisted(() => ({ post: vi.fn(), myVanStock: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ api: { post } }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi: { myVanStock } }));

import { db } from './db';
import { enqueue, listOutbox, markSending } from './outbox';
import { pullVanStock, pushOutbox } from './sync';

beforeEach(async () => {
  await db.outbox.clear();
  await db.van_stock.clear();
  post.mockReset();
  myVanStock.mockReset();
});

describe('pullVanStock — UX M1', () => {
  it('lokal mashina qoldig‘ini serverdagisi bilan almashtiradi', async () => {
    // Arrange: lokalda eski qoldiq, serverda yangi yuklama tushgan
    await db.van_stock.put({
      product: 'old', product_name: 'Eski', product_sku: 'OLD', unit: 'dona', quantity: 3,
    });
    myVanStock.mockResolvedValue([
      { product: 'gel', product_name: 'Yuvish geli 1L', product_sku: 'GEL-1L', unit: 'dona', quantity: '40.000' },
    ]);

    // Act
    await pullVanStock();

    // Assert
    const rows = await db.van_stock.toArray();
    expect(rows).toEqual([
      { product: 'gel', product_name: 'Yuvish geli 1L', product_sku: 'GEL-1L', unit: 'dona', quantity: 40 },
    ]);
  });
});

describe('pushOutbox — UX B1', () => {
  it('oldingi sessiyadan qolgan SENDING operatsiyani qayta yuboradi', async () => {
    // Arrange: tab so'rov paytida yopilgan — yozuv SENDING da qolgan
    const id = await enqueue('sale', { total: 1 }, 'Sotuv · test');
    await markSending([id]);
    post.mockResolvedValue({
      data: {
        success: true,
        data: { results: [{ client_uuid: id, status: 'SENT' }], server_time: 'x' },
      },
    });

    // Act
    const res = await pushOutbox();

    // Assert
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0]?.[1] as { operations: Array<{ client_uuid: string }> };
    expect(body.operations.map((o) => o.client_uuid)).toEqual([id]);
    expect(res.sent).toBe(1);
    expect(await listOutbox()).toHaveLength(0);
  });
});
