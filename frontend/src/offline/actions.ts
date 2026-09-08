import { db } from './db';
import { enqueue } from './outbox';
import { pushOutbox } from './sync';

export interface LocalSaleLine {
  product: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface LocalSaleInput {
  client: string;
  client_name: string;
  payment_type: 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';
  lines: LocalSaleLine[];
  paid_amount?: number;
  due_date?: string | null;
  latitude?: string;
  longitude?: string;
  note?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sotuvni AVVAL lokal bazaga yozadi (CLAUDE.md 4.2):
 *  - outbox'ga operatsiya qo'shadi
 *  - mashina qoldig'ini lokal kamaytiradi (4.3)
 *  - darhol qaytadi ("✅ Saqlandi"), server javobini kutmasdan
 */
export async function saveSaleLocal(input: LocalSaleInput): Promise<string> {
  const total = input.lines.reduce((s, l) => s + l.quantity * l.price, 0);

  const uuid = await enqueue(
    'sale',
    {
      client: input.client,
      payment_type: input.payment_type,
      date: todayISO(),
      device_time: new Date().toISOString(),
      paid_amount:
        input.payment_type === 'ARALASH' ? String(input.paid_amount ?? 0) : undefined,
      due_date: input.due_date ?? undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note ?? '',
      items: input.lines.map((l) => ({
        product: l.product,
        quantity: String(l.quantity),
        price: String(l.price),
      })),
    },
    `Sotuv · ${input.client_name} · ${total.toLocaleString('ru-RU')} so'm`,
  );

  // Lokal mashina qoldig'ini kamaytiramiz
  await db.transaction('rw', db.van_stock, async () => {
    for (const line of input.lines) {
      const vs = await db.van_stock.get(line.product);
      if (vs) {
        await db.van_stock.update(line.product, {
          quantity: Math.max(0, vs.quantity - line.quantity),
        });
      }
    }
  });

  void pushOutbox();
  return uuid;
}

export async function saveExpenseLocal(input: {
  category: string;
  category_name: string;
  amount: number;
  payment_source: 'CASH_ON_HAND' | 'OWN_MONEY' | 'COMPANY_CARD';
  description?: string;
  latitude?: string;
  longitude?: string;
  fuel?: { liters: string; price_per_liter: string; odometer?: number };
}): Promise<string> {
  const uuid = await enqueue(
    'expense',
    {
      category: input.category,
      amount: String(input.amount),
      payment_source: input.payment_source,
      description: input.description ?? '',
      date: todayISO(),
      device_time: new Date().toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      fuel: input.fuel,
    },
    `Xarajat · ${input.category_name} · ${input.amount.toLocaleString('ru-RU')} so'm`,
  );
  void pushOutbox();
  return uuid;
}

export async function saveDebtPaymentLocal(input: {
  debt: string;
  client_name: string;
  amount: number;
  payment_type: 'NAQD' | 'PLASTIK' | 'OTKAZMA';
}): Promise<string> {
  const uuid = await enqueue(
    'debt_payment',
    {
      debt: input.debt,
      amount: String(input.amount),
      payment_type: input.payment_type,
      date: todayISO(),
      device_time: new Date().toISOString(),
    },
    `Qarz to'lovi · ${input.client_name} · ${input.amount.toLocaleString('ru-RU')} so'm`,
  );
  void pushOutbox();
  return uuid;
}

export async function localVanQty(productId: string): Promise<number> {
  const vs = await db.van_stock.get(productId);
  return vs?.quantity ?? 0;
}

/* ------------------------------------------------------------ Buyurtma (v4 T1) */

export interface LocalOrderLine {
  product: string;
  product_name: string;
  quantity: number;
  price: number;
}

/**
 * Buyurtmani (zakazni) AVVAL lokal outbox'ga yozadi (CLAUDE.md 4.2).
 * Qoldiq tekshiruvi yo'q — buyurtma va'da, tovar keyin yuklanadi.
 */
export async function saveOrderLocal(input: {
  client: string;
  client_name: string;
  payment_intent?: 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH' | '';
  desired_date?: string | null;
  note?: string;
  lines: LocalOrderLine[];
}): Promise<string> {
  const total = input.lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const uuid = await enqueue(
    'order_create',
    {
      client: input.client,
      payment_intent: input.payment_intent ?? '',
      desired_date: input.desired_date ?? undefined,
      note: input.note ?? '',
      date: todayISO(),
      device_time: new Date().toISOString(),
      place: true,
      items: input.lines.map((l) => ({
        product: l.product,
        quantity: String(l.quantity),
        price: String(l.price),
      })),
    },
    `Buyurtma · ${input.client_name} · ${total.toLocaleString('ru-RU')} so'm`,
  );
  void pushOutbox();
  return uuid;
}

/**
 * Buyurtmani yetkazish → outbox'ga `order_fulfill` (server Sale yaratadi).
 * Lokal mashina qoldig'ini darhol kamaytiradi (4.3).
 */
export async function fulfillOrderLocal(input: {
  order: string;
  client_name: string;
  payment_type: 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';
  paid_amount?: number;
  due_date?: string | null;
  note?: string;
  lines: Array<{ item: string; product: string; delivered_quantity: number; price?: number }>;
  latitude?: string;
  longitude?: string;
}): Promise<string> {
  const total = input.lines.reduce(
    (s, l) => s + l.delivered_quantity * (l.price ?? 0),
    0,
  );
  const needsDue =
    input.payment_type === 'QARZ' || input.payment_type === 'ARALASH';
  const uuid = await enqueue(
    'order_fulfill',
    {
      order: input.order,
      payment_type: input.payment_type,
      paid_amount:
        input.payment_type === 'ARALASH' ? String(input.paid_amount ?? 0) : undefined,
      due_date: needsDue ? (input.due_date ?? undefined) : undefined,
      note: input.note ?? '',
      date: todayISO(),
      device_time: new Date().toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      lines: input.lines.map((l) => ({
        item: l.item,
        delivered_quantity: String(l.delivered_quantity),
        ...(l.price != null ? { price: String(l.price) } : {}),
      })),
    },
    `Yetkazish · ${input.client_name} · ${total.toLocaleString('ru-RU')} so'm`,
  );

  await db.transaction('rw', db.van_stock, async () => {
    for (const line of input.lines) {
      const vs = await db.van_stock.get(line.product);
      if (vs) {
        await db.van_stock.update(line.product, {
          quantity: Math.max(0, vs.quantity - line.delivered_quantity),
        });
      }
    }
  });

  void pushOutbox();
  return uuid;
}
