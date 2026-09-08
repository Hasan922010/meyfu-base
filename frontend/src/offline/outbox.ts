import { db, type OutboxOp, type OutboxType } from './db';

// CLAUDE.md 4.2 — outbox pattern

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
    attempts: 0,
    status: 'PENDING',
    error: null,
  };
  await db.outbox.put(op);
  return op.client_uuid;
}

export async function pendingCount(): Promise<number> {
  return db.outbox.where('status').anyOf('PENDING', 'FAILED', 'SENDING').count();
}

export async function failedCount(): Promise<number> {
  return db.outbox
    .where('status')
    .equals('FAILED')
    .filter((o) => o.attempts >= 3)
    .count();
}

/** FIFO tartibida yuborilishi kerak bo'lgan operatsiyalar. */
export async function dueOps(): Promise<OutboxOp[]> {
  const all = await db.outbox
    .where('status')
    .anyOf('PENDING', 'FAILED')
    .sortBy('created_at');
  return all.filter((o) => o.attempts < 20 && backoffElapsed(o));
}

/** Exponential backoff: 5s, 15s, 60s, 5min, ... (CLAUDE.md 4.2) */
function backoffElapsed(op: OutboxOp): boolean {
  if (op.attempts === 0) return true;
  const delays = [5, 15, 60, 300, 900, 3600];
  const wait = (delays[Math.min(op.attempts - 1, delays.length - 1)] ?? 3600) * 1000;
  return Date.now() - op.created_at - wait * (op.attempts - 1) > wait;
}

export async function markSending(uuids: string[]): Promise<void> {
  await db.outbox.where('client_uuid').anyOf(uuids).modify({ status: 'SENDING' });
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
  await db.outbox.update(result.client_uuid, {
    status: 'FAILED',
    attempts: op.attempts + 1,
    error: result.error?.message ?? 'Xatolik',
  });
}

export async function listOutbox(): Promise<OutboxOp[]> {
  return db.outbox.orderBy('created_at').toArray();
}

export async function retryFailed(): Promise<void> {
  await db.outbox
    .where('status')
    .anyOf('FAILED', 'CONFLICT')
    .modify({ status: 'PENDING', error: null });
}
