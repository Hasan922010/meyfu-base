import { db, type OutboxOp, type OutboxType } from './db';

// CLAUDE.md 4.2 — outbox pattern

/** Maksimal avtomatik urinishlar; keyin operatsiya DEAD bo'ladi (audit OFF-001). */
export const MAX_ATTEMPTS = 20;
const PERMANENT_ERROR_CODES = new Set([
  'BAD_NUMBER',
  'NOT_FOUND',
  'UNKNOWN_OP_TYPE',
  'VALIDATION_ERROR',
  'INVALID',
]);

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
  await db.outbox.put(op);
  return op.client_uuid;
}

/** Avtomatik yuboriladigan navbat (DEAD sanalmaydi). */
export async function pendingCount(): Promise<number> {
  return db.outbox.where('status').anyOf('PENDING', 'FAILED', 'SENDING').count();
}

/** Foydalanuvchiga ko'rsatiladigan muammoli operatsiyalar (3+ urinish yoki DEAD). */
export async function failedCount(): Promise<number> {
  return db.outbox
    .where('status')
    .anyOf('FAILED', 'DEAD', 'CONFLICT')
    .filter((o) => o.status !== 'FAILED' || o.attempts >= 3)
    .count();
}

/** 20 urinishdan keyin to'xtatilgan — foydalanuvchi aralashuvi kerak. */
export async function deadCount(): Promise<number> {
  return db.outbox.where('status').equals('DEAD').count();
}

/** FIFO tartibida yuborilishi kerak bo'lgan operatsiyalar. */
export async function dueOps(): Promise<OutboxOp[]> {
  const all = await db.outbox
    .where('status')
    .anyOf('PENDING', 'FAILED')
    .sortBy('created_at');
  return all.filter((o) => o.attempts < MAX_ATTEMPTS && backoffElapsed(o));
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

export async function applyResult(result: {
  client_uuid: string;
  status: string;
  error?: { code?: string; message?: string };
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
  const errorCode = result.error?.code;
  const permanent = errorCode ? PERMANENT_ERROR_CODES.has(errorCode) : false;
  await db.outbox.update(result.client_uuid, {
    status: permanent || attempts >= MAX_ATTEMPTS ? 'DEAD' : 'FAILED',
    attempts,
    last_attempt_at: Date.now(),
    error: result.error?.message ?? 'Xatolik',
  });
}

export async function listOutbox(): Promise<OutboxOp[]> {
  return db.outbox.orderBy('created_at').toArray();
}

/** FAILED / CONFLICT / DEAD operatsiyalarni qaytadan navbatga qo'yadi. */
export async function retryFailed(): Promise<void> {
  await db.outbox
    .where('status')
    .anyOf('FAILED', 'CONFLICT', 'DEAD')
    .modify({ status: 'PENDING', attempts: 0, last_attempt_at: null, error: null });
}

/** Bitta operatsiyani navbatdan butunlay o'chiradi (DEAD uchun UI'da). */
export async function deleteOp(clientUuid: string): Promise<void> {
  await db.outbox.delete(clientUuid);
}
