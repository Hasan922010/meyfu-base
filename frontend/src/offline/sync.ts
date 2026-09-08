import { api } from '@/shared/api/client';
import { catalogApi } from '@/shared/api/catalog';
import { clientsApi } from '@/shared/api/clients';
import { companyApi } from '@/shared/api/company';
import { ordersApi } from '@/shared/api/orders';
import { warehouseApi } from '@/shared/api/warehouse';
import { saveCompanyCache } from '@/mobile/lib/companyCache';
import type { ApiSuccess } from '@/shared/types/api';

import { db, getMeta, setMeta } from './db';
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

/** Katalog + mijoz + mashina qoldig'ini serverdan lokal bazaga tortadi. */
export async function pullReferenceData(): Promise<void> {
  const since = await getMeta('catalog_since');
  const catalog = await catalogApi.products({ page_size: 500 });
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

  const van = await warehouseApi.myVanStock();
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

  // Yetkazish uchun biriktirilgan buyurtmalar (v4 T1) — best-effort
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

  // Kompaniya rekvizitlari + muhr (chek PDF uchun) — best-effort
  try {
    await saveCompanyCache(await companyApi.public());
  } catch {
    /* rekvizitsiz ham chek chiqadi */
  }

  await setMeta('last_pull', new Date().toISOString());
  if (!since) await setMeta('catalog_since', new Date().toISOString());
}

/** Outbox'ni serverga yuboradi. Onlayn bo'lganda chaqiriladi. */
export async function pushOutbox(): Promise<{ sent: number; failed: number }> {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0 };
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

    let sent = 0;
    let failed = 0;
    for (const r of data.data.results) {
      await applyResult(r);
      if (r.status === 'SENT' || r.status === 'DUPLICATE') sent += 1;
      else failed += 1;
    }
    return { sent, failed };
  } catch {
    // Tarmoq xatosi — SENDING'larni PENDING'ga qaytaramiz
    await db.outbox.where('status').equals('SENDING').modify({ status: 'PENDING' });
    return { sent: 0, failed: 0 };
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
