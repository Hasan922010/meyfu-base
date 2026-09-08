import Dexie, { type EntityTable } from 'dexie';

// CLAUDE.md 4.1 — lokal baza (Dexie / IndexedDB)

export interface CachedProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  retail_price: string;
  wholesale_price: string;
  min_price: string;
  is_active: boolean;
  image_thumb: string | null;
}

export interface CachedClient {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  route: string | null;
  debt_limit: string;
  current_debt: string;
  is_blocked: boolean;
}

export interface CachedVanStock {
  product: string;
  product_name: string;
  product_sku: string;
  unit: string;
  quantity: number; // lokal hisob-kitob uchun raqam (CLAUDE.md 4.3)
}

/** Yetkazish uchun keshlangan buyurtma (offline yetkazish oqimi — v4 T1). */
export interface CachedOrder {
  id: string;
  number: string;
  client: string;
  client_name: string;
  status: string;
  status_display: string;
  payment_intent: string;
  total_amount: string;
  taken_by_name: string;
  items: Array<{
    id: string;
    product: string;
    product_name: string;
    quantity: string;
    delivered_quantity: string;
    price: string;
  }>;
}

export type OutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CONFLICT';
export type OutboxType =
  | 'sale'
  | 'debt_payment'
  | 'sale_return'
  | 'visit'
  | 'expense'
  | 'order_create'
  | 'order_fulfill';

export interface OutboxOp {
  client_uuid: string; // FRONTENDDA generatsiya, o'zgarmaydi (CLAUDE.md 4.2)
  type: OutboxType;
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  status: OutboxStatus;
  error: string | null;
  summary: string; // UI uchun qisqa tavsif
}

export interface MetaRow {
  key: string;
  value: string;
}

const db = new Dexie('meyfu') as Dexie & {
  products: EntityTable<CachedProduct, 'id'>;
  clients: EntityTable<CachedClient, 'id'>;
  van_stock: EntityTable<CachedVanStock, 'product'>;
  orders: EntityTable<CachedOrder, 'id'>;
  outbox: EntityTable<OutboxOp, 'client_uuid'>;
  meta: EntityTable<MetaRow, 'key'>;
};

db.version(1).stores({
  products: 'id, sku, name',
  clients: 'id, name, route',
  van_stock: 'product',
  outbox: 'client_uuid, status, created_at',
  meta: 'key',
});

db.version(2).stores({
  orders: 'id, status',
});

export { db };

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
