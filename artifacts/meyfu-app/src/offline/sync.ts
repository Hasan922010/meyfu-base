import { api } from '@/shared/api/client';
import { catalogApi } from '@/shared/api/catalog';
import { clientsApi } from '@/shared/api/clients';
import { companyApi } from '@/shared/api/company';
import { ordersApi } from '@/shared/api/orders';
import {
  bulkSyncDataShape,
  clientListShape,
  productListShape,
  vanStockListShape,
} from '@/shared/api/schemas';
import { warehouseApi } from '@/shared/api/warehouse';
import { assertApiShape } from '@/shared/lib/validate';
import type { ApiSuccess } from '@/shared/types/api';

import { db, getMeta, setMeta } from './db';
import type { CachedOrder } from './db';
import { applyResult, dueOps, markSending } from './outbox';

interface BulkSyncResult {
  results: Array<{
    client_uuid: string;
    status: string;
    server_id?: string;
    error?: { message?: string };
  }>;
  server_time: string;
}

let syncing = false;

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{
    results: T[];
    page: number;
    pages: number;
    next: string | null;
  }>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const response = await fetchPage(page);
    all.push(...response.results);
    if (!response.next && page >= response.pages) return all;
    page += 1;
  }
}

/** Katalog + mijoz + mashina qoldig'ini serverdan lokal bazaga tortadi. */
export async function pullReferenceData(): Promise<void> {
  const since = await getMeta('catalog_since');
  const products = await fetchAllPages(async (page) => {
    const response = await catalogApi.products({ page, page_size: 500 });
    assertApiShape(productListShape, response.results, 'sync/catalog');
    return response;
  });
  const clients = await fetchAllPages(async (page) => {
    const response = await clientsApi.list({ page, page_size: 500 });
    assertApiShape(clientListShape, response.results, 'sync/clients');
    return response;
  });
  const van = await warehouseApi.myVanStock();
  assertApiShape(vanStockListShape, van, 'sync/van-stock');

  let orders: CachedOrder[] | null = null;
  try {
    const toDeliver = await ordersApi.myToDeliver();
    orders = toDeliver.map((o) => ({
      id: o.id,
      number: o.number,
      client: o.client,
      client_name: o.client_name,
      status: o.status,
      status_display: o.status_display,
      payment_intent: o.payment_intent,
      total_amount: o.total_amount,
      taken_by_name: o.taken_by_name,
      items: o.items.map((it) => ({
        id: it.id,
        product: it.product,
        product_name: it.product_name,
        quantity: it.quantity,
        delivered_quantity: it.delivered_quantity,
        price: it.price,
      })),
    }));
  } catch {
    // Buyurtma oqimi hali yo'q bo'lishi mumkin — eski snapshotni saqlaymiz.
  }

  await db.transaction('rw', db.products, db.clients, db.van_stock, db.orders, async () => {
    await db.products.clear();
    await db.products.bulkPut(
      products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      unit: p.unit_name,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      min_price: p.min_price,
      is_active: p.is_active,
      image_thumb: p.image_thumb ?? null,
      })),
    );
    await db.clients.clear();
    await db.clients.bulkPut(
      clients.map((c) => ({
      id: c.id,
      name: c.name,
      owner_name: c.owner_name,
      phone: c.phone,
      address: c.address,
      route: c.route,
      debt_limit: c.debt_limit,
      current_debt: c.current_debt,
      is_blocked: c.is_blocked,
      })),
    );
    await db.van_stock.clear();
    await db.van_stock.bulkPut(
      van.map((v) => ({
      product: v.product,
      product_name: v.product_name,
      product_sku: v.product_sku,
      unit: v.unit,
      quantity: Number(v.quantity),
      })),
    );
    if (orders) {
      await db.orders.clear();
      await db.orders.bulkPut(orders);
    }
  });

  // Kompaniya rekvizitlari + muhr (chek PDF uchun) — best-effort.
  // Dinamik import — `companyCache` faqat chek oqimi bilan yuklanadi (PERF-001).
  try {
    const { saveCompanyCache } = await import('@/mobile/lib/companyCache');
    await saveCompanyCache(await companyApi.public());
  } catch {
    /* rekvizitsiz ham chek chiqadi */
  }

  await setMeta('last_pull', new Date().toISOString());
  if (!since) await setMeta('catalog_since', new Date().toISOString());
}

/** Outbox'ni serverga yuboradi. Onlayn bo'lganda chaqiriladi. */
export async function pushOutbox(): Promise<{ sent: number; failed: number }> {
  if (syncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { sent: 0, failed: 0 };
  }
  syncing = true;
  try {
    const ops = await dueOps();
    if (ops.length === 0) return { sent: 0, failed: 0 };

    await markSending(ops.map((o) => o.client_uuid));

    const { data } = await api.post<ApiSuccess<BulkSyncResult>>(
      '/sales/bulk-sync/',
      {
        operations: ops.map((o) => ({
          type: o.type,
          client_uuid: o.client_uuid,
          payload: o.payload,
        })),
      },
    );

    assertApiShape(bulkSyncDataShape, data.data, 'bulk-sync');

    let sent = 0;
    let failed = 0;
    for (const r of data.data.results) {
      await applyResult(r);
      if (r.status === 'SENT' || r.status === 'DUPLICATE') sent += 1;
      else failed += 1;
    }
    return { sent, failed };
  } catch (err) {
    // Tarmoq yoki javob-shakli xatosi — SENDING'larni PENDING'ga qaytaramiz
    console.warn('[pushOutbox]', err);
    await db.outbox
      .where('client_uuid')
      .anyOf(ops.map((o) => o.client_uuid))
      .modify({ status: 'PENDING' });
    return { sent: 0, failed: 0 };
  } finally {
    syncing = false;
  }
}

export async function fullSync(): Promise<void> {
  await pushOutbox();
  if (typeof navigator === 'undefined' || navigator.onLine) {
    await pullReferenceData();
    await pushOutbox();
  }
}
