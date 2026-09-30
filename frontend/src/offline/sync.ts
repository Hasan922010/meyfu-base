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
import { useAuthStore } from '@/shared/store/authStore';
import type { ApiSuccess } from '@/shared/types/api';

import { db, getMeta, setMeta, type OutboxOp } from './db';
import {
  applyResult,
  dueOps,
  markSending,
  markChunkFailed,
  recoverOrphanedSending,
  unsentStockDelta,
} from './outbox';

interface BulkSyncResult {
  results: Array<{
    client_uuid: string;
    status: string;
    server_id?: string;
    error?: { code?: string; message?: string };
  }>;
  server_time: string;
}

let syncing = false;

/** Katalog + mijoz + mashina qoldig'ini serverdan lokal bazaga tortadi. */
export async function pullReferenceData(): Promise<void> {
  const since = await getMeta('catalog_since');
  const catalog = await catalogApi.products({ page_size: 500 });
  assertApiShape(productListShape, catalog.results, 'sync/catalog');
  await db.products.bulkPut(
    catalog.results.map((p) => ({
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

  const clients = await clientsApi.list({ page_size: 500 });
  assertApiShape(clientListShape, clients.results, 'sync/clients');
  await db.clients.bulkPut(
    clients.results.map((c) => ({
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

  // Zakaz oluvchida mashina qoldig'i va yetkazish yo'q (backend 403 qaytaradi)
  if (useAuthStore.getState().user?.role !== 'ORDER_TAKER') {
    await pullVanStock();
    await pullOrdersToDeliver();
  }

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

/**
 * Faqat mashina qoldig'ini serverdan tortadi. Yuklama tasdiqlangach chaqiriladi —
 * aks holda sotuv ekrani (lokal van_stock) yangi tovarni ko'rmaydi (UX audit M1).
 */
/** Yetkazish uchun biriktirilgan buyurtmalar (v4 T1) — best-effort. */
async function pullOrdersToDeliver(): Promise<void> {
  try {
    const toDeliver = await ordersApi.myToDeliver();
    await db.orders.clear();
    await db.orders.bulkPut(
      toDeliver.map((o) => ({
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
      })),
    );
  } catch {
    // buyurtma oqimi hali yo'q bo'lishi mumkin — jimgina o'tkazamiz
  }
}

export async function pullVanStock(): Promise<void> {
  const van = await warehouseApi.myVanStock();
  assertApiShape(vanStockListShape, van, 'sync/van-stock');
  await db.transaction('rw', db.van_stock, db.outbox, async () => {
    // yuborilmagan sotuv/qaytarishlar serverda hali yo'q — ularni qayta qo'llaymiz
    const pending = await unsentStockDelta();
    await db.van_stock.clear();
    await db.van_stock.bulkPut(
      van.map((v) => ({
        product: v.product,
        product_name: v.product_name,
        product_sku: v.product_sku,
        unit: v.unit,
        quantity: Math.max(0, Number(v.quantity) + (pending.get(v.product) ?? 0)),
      })),
    );
  });
}

/** Bitta so'rovdagi operatsiyalar soni — bir haftalik offline navbat ham
 * katta javob/413 bilan yiqilmasin (audit FE-105). */
export const SYNC_CHUNK = 50;

async function sendChunk(ops: OutboxOp[]): Promise<{ sent: number; failed: number }> {
  await markSending(ops.map((o) => o.client_uuid));
  const { data } = await api.post<ApiSuccess<BulkSyncResult>>('/sales/bulk-sync/', {
    operations: ops.map((o) => ({
      type: o.type,
      client_uuid: o.client_uuid,
      payload: o.payload,
    })),
  });
  assertApiShape(bulkSyncDataShape, data.data, 'bulk-sync');

  let sent = 0;
  let failed = 0;
  for (const r of data.data.results) {
    await applyResult(r);
    if (r.status === 'SENT' || r.status === 'DUPLICATE') sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

/** Outbox'ni serverga yuboradi. Onlayn bo'lganda chaqiriladi. */
export async function pushOutbox(): Promise<{ sent: number; failed: number }> {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0 };
  syncing = true;
  let sent = 0;
  let failed = 0;
  try {
    // Bu tabda yuborish ketmayapti — demak qolgan SENDING'lar oldingi sessiyadan yetim
    await recoverOrphanedSending();
    const ops = await dueOps();
    for (let i = 0; i < ops.length; i += SYNC_CHUNK) {
      const chunk = ops.slice(i, i + SYNC_CHUNK);
      try {
        const r = await sendChunk(chunk);
        sent += r.sent;
        failed += r.failed;
      } catch (err) {
        // Tarmoq/5xx/javob-shakli xatosi — urinish sifatida hisoblanadi, shunda
        // backoff va "3+ urinish" ogohlantirishi ishlaydi (audit FE-105).
        // FIFO: keyingi paketlarni bu safar yubormaymiz.
        console.warn('[pushOutbox]', err);
        await markChunkFailed(chunk, err);
        failed += chunk.length;
        break;
      }
    }
    return { sent, failed };
  } finally {
    syncing = false;
  }
}

export async function fullSync(): Promise<void> {
  await pushOutbox();
  if (navigator.onLine) {
    await pullReferenceData();
    await pushOutbox();
  }
}
