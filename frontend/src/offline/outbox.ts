import { useAuthStore } from '@/shared/store/authStore';

import { db, type OutboxOp, type OutboxType } from './db';

// CLAUDE.md 4.2 — outbox pattern

/** Maksimal avtomatik urinishlar; keyin operatsiya DEAD bo'ladi (audit OFF-001). */
export const MAX_ATTEMPTS = 20;

/** Joriy foydalanuvchi — navbat faqat uning operatsiyalarini ko'radi (audit FE-101). */
function currentOwner(): string | undefined {
  return useAuthStore.getState().user?.id;
}

function isMine(op: OutboxOp): boolean {
  return op.owner_id === currentOwner();
}

export function newUuid(): string {
  return crypto.randomUUID();
}

export async function enqueue(
  type: OutboxType,
  payload: Record<string, unknown>,
  summary: string,
  clientUuid?: string,
): Promise<string> {
  const op: OutboxOp = {
    client_uuid: clientUuid ?? newUuid(),
    type,
    payload,
    summary,
    created_at: Date.now(),
    last_attempt_at: null,
    attempts: 0,
    status: 'PENDING',
    error: null,
  };
  const owner = currentOwner();
  if (owner) op.owner_id = owner;
  await db.outbox.put(op);
  return op.client_uuid;
}

/** Avtomatik yuboriladigan navbat (DEAD sanalmaydi). */
export async function pendingCount(): Promise<number> {
  return db.outbox.where('status').anyOf('PENDING', 'FAILED', 'SENDING').filter(isMine).count();
}

/** Foydalanuvchiga ko'rsatiladigan muammoli operatsiyalar (3+ urinish yoki DEAD). */
export async function failedCount(): Promise<number> {
  return db.outbox
    .where('status')
    .anyOf('FAILED', 'DEAD', 'CONFLICT')
    .filter((o) => isMine(o) && (o.status !== 'FAILED' || o.attempts >= 3))
    .count();
}

/**
 * Serverga hali yetmagan operatsiyalar — bular bor ekan kun yopilmaydi (UX audit M6).
 * CONFLICT sanalmaydi: server uni qabul qilgan, admin hal qiladi.
 */
export async function unsentCount(): Promise<number> {
  return db.outbox
    .where('status')
    .anyOf('PENDING', 'SENDING', 'FAILED', 'DEAD')
    .filter(isMine)
    .count();
}

/** 20 urinishdan keyin to'xtatilgan — foydalanuvchi aralashuvi kerak. */
export async function deadCount(): Promise<number> {
  return db.outbox.where('status').equals('DEAD').filter(isMine).count();
}

/** FIFO tartibida yuborilishi kerak bo'lgan operatsiyalar. */
export async function dueOps(): Promise<OutboxOp[]> {
  const all = await db.outbox
    .where('status')
    .anyOf('PENDING', 'FAILED')
    .sortBy('created_at');
  return all.filter((o) => isMine(o) && o.attempts < MAX_ATTEMPTS && backoffElapsed(o));
}

/** Exponential backoff: 5s, 15s, 60s, 5min, 15min, 60min — oxirgi urinishdan (CLAUDE.md 4.2) */
function backoffElapsed(op: OutboxOp): boolean {
  if (op.attempts === 0) return true;
  const delays = [5, 15, 60, 300, 900, 3600];
  const waitMs =
    (delays[Math.min(op.attempts - 1, delays.length - 1)] ?? 3600) * 1000;
  const since = op.last_attempt_at ?? op.created_at;
  return Date.now() - since >= waitMs;
}

export async function markSending(uuids: string[]): Promise<void> {
  const now = Date.now();
  await db.outbox
    .where('client_uuid')
    .anyOf(uuids)
    .modify({ status: 'SENDING', last_attempt_at: now });
}

/**
 * Oldingi sessiyada so'rov paytida tab yopilgan bo'lsa, SENDING yozuvlar egasiz qoladi
 * va dueOps() ularni hech qachon olmaydi (UX audit B1). Ularni PENDING ga qaytaramiz.
 * Qayta yuborish xavfsiz — server client_uuid bo'yicha dublikatni DUPLICATE qaytaradi.
 */
export async function recoverOrphanedSending(): Promise<number> {
  return db.outbox.where('status').equals('SENDING').modify({ status: 'PENDING' });
}

export async function applyResult(result: {
  client_uuid: string;
  status: string;
  error?: { message?: string };
}): Promise<void> {
  const op = await db.outbox.get(result.client_uuid);
  if (!op) return;

  if (result.status === 'SENT' || result.status === 'DUPLICATE') {
    await db.outbox.delete(result.client_uuid);
    return;
  }
  if (result.status === 'CONFLICT') {
    await db.outbox.update(result.client_uuid, {
      status: 'CONFLICT',
      error: 'Serverda qoldiq yetmadi — admin hal qiladi',
    });
    return;
  }
  // FAILED
  const attempts = op.attempts + 1;
  await db.outbox.update(result.client_uuid, {
    status: attempts >= MAX_ATTEMPTS ? 'DEAD' : 'FAILED',
    attempts,
    last_attempt_at: Date.now(),
    error: result.error?.message ?? 'Xatolik',
  });
}

/** Butun so'rov yiqildi (tarmoq, 5xx): paketdagi har operatsiya bitta urinish. */
export async function markChunkFailed(ops: OutboxOp[], err: unknown): Promise<void> {
  const message =
    err instanceof Error && err.message ? err.message : "Server bilan aloqa bo'lmadi";
  const now = Date.now();
  await db.transaction('rw', db.outbox, async () => {
    for (const op of ops) {
      const attempts = op.attempts + 1;
      await db.outbox.update(op.client_uuid, {
        status: attempts >= MAX_ATTEMPTS ? 'DEAD' : 'FAILED',
        attempts,
        last_attempt_at: now,
        error: message,
      });
    }
  });
}

export async function listOutbox(): Promise<OutboxOp[]> {
  return db.outbox.orderBy('created_at').filter(isMine).toArray();
}

/** FAILED / CONFLICT / DEAD operatsiyalarni qaytadan navbatga qo'yadi. */
export async function retryFailed(): Promise<void> {
  await db.outbox
    .where('status')
    .anyOf('FAILED', 'CONFLICT', 'DEAD')
    .filter(isMine)
    .modify({ status: 'PENDING', attempts: 0, last_attempt_at: null, error: null });
}

/** Bitta operatsiyani navbatdan butunlay o'chiradi (DEAD uchun UI'da). */
export async function deleteOp(clientUuid: string): Promise<void> {
  await db.outbox.delete(clientUuid);
}

type StockLine = { product?: unknown; quantity?: unknown; delivered_quantity?: unknown };

function lineQty(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Hali serverga yetmagan operatsiyalarning mashina qoldig'iga ta'siri
 * (mahsulot → delta). Serverdan qoldiq tortilganda shu delta qo'shiladi —
 * aks holda offline sotilgan tovar yana "bor" bo'lib ko'rinardi (audit FE-102).
 */
export async function unsentStockDelta(): Promise<Map<string, number>> {
  const ops = await db.outbox
    .where('status')
    .anyOf('PENDING', 'SENDING', 'FAILED', 'DEAD')
    .filter(isMine)
    .toArray();
  const delta = new Map<string, number>();
  const add = (product: unknown, qty: number): void => {
    if (typeof product !== 'string' || qty === 0) return;
    delta.set(product, (delta.get(product) ?? 0) + qty);
  };
  for (const op of ops) {
    const p = op.payload as { items?: StockLine[]; lines?: StockLine[]; restock?: boolean };
    if (op.type === 'sale') {
      for (const l of p.items ?? []) add(l.product, -lineQty(l.quantity));
    } else if (op.type === 'order_fulfill') {
      for (const l of p.lines ?? []) add(l.product, -lineQty(l.delivered_quantity));
    } else if (op.type === 'sale_return' && p.restock) {
      for (const l of p.items ?? []) add(l.product, lineQty(l.quantity));
    }
  }
  return delta;
}
