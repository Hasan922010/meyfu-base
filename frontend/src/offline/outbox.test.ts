import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import {
  MAX_ATTEMPTS,
  applyResult,
  deadCount,
  deleteOp,
  enqueue,
  failedCount,
  listOutbox,
  markSending,
  newUuid,
  pendingCount,
  recoverOrphanedSending,
  retryFailed,
} from './outbox';

async function failNTimes(uuid: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await applyResult({ client_uuid: uuid, status: 'FAILED' });
  }
}

beforeEach(async () => {
  await db.outbox.clear();
});

describe('newUuid', () => {
  it('v4 UUID qaytaradi', () => {
    expect(newUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('enqueue', () => {
  it('operatsiyani navbatga qo‘shadi va client_uuid qaytaradi', async () => {
    const uuid = await enqueue('sale', { x: 1 }, 'Sotuv · test');
    const rows = await listOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      client_uuid: uuid,
      type: 'sale',
      status: 'PENDING',
      attempts: 0,
    });
  });

  it('bir xil client_uuid — bitta yozuv (idempotent, CLAUDE.md 4.2)', async () => {
    const id = newUuid();
    await enqueue('sale', { n: 1 }, 's1', id);
    await enqueue('sale', { n: 2 }, 's2', id);
    await enqueue('sale', { n: 3 }, 's3', id);
    expect(await listOutbox()).toHaveLength(1);
  });
});

describe('applyResult', () => {
  it('SENT — yozuvni o‘chiradi', async () => {
    const uuid = await enqueue('expense', {}, 'x');
    await applyResult({ client_uuid: uuid, status: 'SENT' });
    expect(await listOutbox()).toHaveLength(0);
  });

  it('DUPLICATE — yozuvni o‘chiradi', async () => {
    const uuid = await enqueue('expense', {}, 'x');
    await applyResult({ client_uuid: uuid, status: 'DUPLICATE' });
    expect(await listOutbox()).toHaveLength(0);
  });

  it('FAILED — attempts oshadi, status FAILED, last_attempt_at yoziladi', async () => {
    const uuid = await enqueue('sale', {}, 'x');
    await applyResult({
      client_uuid: uuid,
      status: 'FAILED',
      error: { message: 'boom' },
    });
    const [row] = await listOutbox();
    expect(row?.status).toBe('FAILED');
    expect(row?.attempts).toBe(1);
    expect(row?.error).toBe('boom');
    expect(typeof row?.last_attempt_at).toBe('number');
  });

  it('CONFLICT — status CONFLICT', async () => {
    const uuid = await enqueue('sale', {}, 'x');
    await applyResult({ client_uuid: uuid, status: 'CONFLICT' });
    const [row] = await listOutbox();
    expect(row?.status).toBe('CONFLICT');
  });
});

describe('pendingCount / failedCount / retryFailed', () => {
  it('pendingCount PENDING+FAILED+SENDING ni sanaydi', async () => {
    await enqueue('sale', {}, 'a');
    const b = await enqueue('sale', {}, 'b');
    await applyResult({ client_uuid: b, status: 'FAILED' });
    expect(await pendingCount()).toBe(2);
  });

  it('failedCount faqat 3+ urinishdagilarni sanaydi', async () => {
    const id = newUuid();
    await enqueue('sale', {}, 'x', id);
    await failNTimes(id, 3);
    expect(await failedCount()).toBe(1);
  });

  it('retryFailed FAILED/CONFLICT/DEAD ni PENDING ga qaytaradi (attempts=0)', async () => {
    const a = await enqueue('sale', {}, 'a');
    await failNTimes(a, 5);
    await retryFailed();
    const [row] = await listOutbox();
    expect(row?.status).toBe('PENDING');
    expect(row?.attempts).toBe(0);
    expect(row?.last_attempt_at).toBeNull();
    expect(row?.error).toBeNull();
  });
});

describe('OFF-001 — DEAD holati', () => {
  it(`${MAX_ATTEMPTS} urinishdan keyin DEAD bo'ladi, pendingCount sanamaydi`, async () => {
    const id = newUuid();
    await enqueue('sale', {}, 'x', id);
    await failNTimes(id, MAX_ATTEMPTS);
    const [row] = await listOutbox();
    expect(row?.status).toBe('DEAD');
    expect(await deadCount()).toBe(1);
    expect(await pendingCount()).toBe(0);
  });

  it('DEAD operatsiyani deleteOp o‘chiradi', async () => {
    const id = newUuid();
    await enqueue('sale', {}, 'x', id);
    await failNTimes(id, MAX_ATTEMPTS);
    await deleteOp(id);
    expect(await listOutbox()).toHaveLength(0);
  });
});

describe('markSending', () => {
  it('last_attempt_at ni belgilaydi va statusni SENDING qiladi', async () => {
    const id = await enqueue('sale', {}, 'x');
    await markSending([id]);
    const [row] = await listOutbox();
    expect(row?.status).toBe('SENDING');
    expect(typeof row?.last_attempt_at).toBe('number');
  });
});

describe('recoverOrphanedSending (UX B1)', () => {
  it('yetim SENDING yozuvni PENDING ga qaytaradi, attempts o‘zgarmaydi', async () => {
    const id = await enqueue('sale', {}, 'x');
    await markSending([id]);

    const recovered = await recoverOrphanedSending();

    expect(recovered).toBe(1);
    const [row] = await listOutbox();
    expect(row?.status).toBe('PENDING');
    expect(row?.attempts).toBe(0);
  });

  it('boshqa statuslarga tegmaydi', async () => {
    const failed = await enqueue('sale', {}, 'f');
    await failNTimes(failed, 1);
    const conflict = await enqueue('sale', {}, 'c');
    await applyResult({ client_uuid: conflict, status: 'CONFLICT' });

    expect(await recoverOrphanedSending()).toBe(0);
    const statuses = (await listOutbox()).map((o) => o.status).sort();
    expect(statuses).toEqual(['CONFLICT', 'FAILED']);
  });
});
