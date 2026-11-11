import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, myVanStock, clientsList } = vi.hoisted(() => ({
  post: vi.fn(),
  myVanStock: vi.fn(),
  clientsList: vi.fn(),
}));
vi.mock('@/shared/api/client', () => ({ api: { post } }));
vi.mock('@/shared/api/warehouse', () => ({ warehouseApi: { myVanStock } }));
vi.mock('@/shared/api/catalog', () => ({
  catalogApi: { products: vi.fn().mockResolvedValue({ results: [] }) },
}));
vi.mock('@/shared/api/clients', () => ({
  clientsApi: { list: clientsList },
}));
vi.mock('@/shared/api/orders', () => ({
  ordersApi: { myToDeliver: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/shared/api/company', () => ({
  companyApi: { public: vi.fn().mockRejectedValue(new Error('offline')) },
}));

import { db } from './db';
import { enqueue, listOutbox, markSending } from './outbox';
import { useAuthStore } from '@/shared/store/authStore';
import type { User } from '@/shared/types/api';

import { fullSync, pullReferenceData, pullVanStock, pushOutbox } from './sync';

beforeEach(async () => {
  await db.outbox.clear();
  await db.van_stock.clear();
  await db.clients.clear();
  post.mockReset();
  myVanStock.mockReset();
  clientsList.mockReset();
  clientsList.mockResolvedValue({ results: [], next: null });
  useAuthStore.setState({ user: null });
});

describe('fullSync — UX N3', () => {
  it('ilova ochilganda avval navbatni yuboradi, keyin mashina qoldig‘ini tortadi', async () => {
    // Arrange: offline qilingan sotuv navbatda
    const id = await enqueue('sale', { total: 1 }, 'Sotuv · test');
    post.mockResolvedValue({
      data: {
        success: true,
        data: { results: [{ client_uuid: id, status: 'SENT' }], server_time: 'x' },
      },
    });
    myVanStock.mockResolvedValue([]);

    // Act
    await fullSync();

    // Assert: yuborish tortishdan oldin — aks holda server hali bilmagan sotuv
    // lokal qoldiqdan "qaytib" qolardi
    expect(post).toHaveBeenCalled();
    expect(myVanStock).toHaveBeenCalled();
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(
      myVanStock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(await listOutbox()).toHaveLength(0);
  });
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

describe('pullReferenceData — zakaz oluvchi', () => {
  it('mashina qoldig‘ini so‘ramaydi — zakaz oluvchida u yo‘q (backend 403)', async () => {
    // Arrange
    useAuthStore.setState({ user: { role: 'ORDER_TAKER' } as User });

    // Act
    await pullReferenceData();

    // Assert
    expect(myVanStock).not.toHaveBeenCalled();
  });

  it('mijozlar ro‘yxatini sahifalab tortadi va o‘chirilgan/boshqaga o‘tgan mijozni tozalaydi', async () => {
    await db.clients.put({
      id: 'stale',
      name: 'Eski Mijoz',
      owner_name: '',
      phone: '',
      address: '',
      route: null,
      debt_limit: '0',
      current_debt: '0',
      is_blocked: false,
    });
    clientsList
      .mockResolvedValueOnce({
        count: 2,
        next: '?page=2',
        results: [
          {
            id: 'c1', name: 'Birinchi', owner_name: '', phone: '+998901112233',
            address: '', route: null, debt_limit: '0', current_debt: '0', is_blocked: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        results: [
          {
            id: 'c2', name: 'Ikkinchi', owner_name: '', phone: '+998902223344',
            address: '', route: null, debt_limit: '0', current_debt: '0', is_blocked: false,
          },
        ],
      });
    useAuthStore.setState({ user: { role: 'ORDER_TAKER' } as User });

    await pullReferenceData();

    expect(clientsList).toHaveBeenCalledTimes(2);
    expect(clientsList).toHaveBeenNthCalledWith(1, { page: 1, page_size: 500 });
    expect(clientsList).toHaveBeenNthCalledWith(2, { page: 2, page_size: 500 });
    const rows = await db.clients.toArray();
    expect(rows.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
  });
});

describe('pullVanStock — audit FE-102', () => {
  it('yuborilmagan sotuvni server qoldig‘idan ayiradi (ortiqcha sotuv bo‘lmasin)', async () => {
    // Arrange: offline 5 dona sotilgan, server hali bilmaydi (10 dona deydi)
    await enqueue('sale', { items: [{ product: 'p1', quantity: '5', price: '1000' }] }, 'Sotuv');
    myVanStock.mockResolvedValue([
      { product: 'p1', product_name: 'Kukun', product_sku: 'K1', unit: 'dona', quantity: '10' },
    ]);

    // Act
    await pullVanStock();

    // Assert
    expect((await db.van_stock.get('p1'))?.quantity).toBe(5);
  });
});

describe('pushOutbox — audit FE-105', () => {
  it('butun so‘rov yiqilsa urinish sanaladi (backoff ishlaydi)', async () => {
    const id = await enqueue('sale', { total: 1 }, 'Sotuv');
    post.mockRejectedValue(new Error('Network Error'));

    await pushOutbox();

    const op = await db.outbox.get(id);
    expect(op?.status).toBe('FAILED');
    expect(op?.attempts).toBe(1);
  });

  it('katta navbatni 50 talik paketlarda yuboradi', async () => {
    for (let i = 0; i < 120; i += 1) await enqueue('sale', { i }, `S${i}`);
    post.mockImplementation((_url: string, body: { operations: { client_uuid: string }[] }) =>
      Promise.resolve({
        data: {
          success: true,
          data: {
            results: body.operations.map((o) => ({ client_uuid: o.client_uuid, status: 'SENT' })),
          },
        },
      }),
    );

    const r = await pushOutbox();

    expect(post).toHaveBeenCalledTimes(3);
    expect(r.sent).toBe(120);
  });
});
