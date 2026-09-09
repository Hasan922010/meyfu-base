import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import {
  applyResult,
  enqueue,
  failedCount,
  listOutbox,
  newUuid,
  pendingCount,
  retryFailed,
} from './outbox';

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

  it('FAILED — attempts oshadi, status FAILED', async () => {
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
    for (let i = 0; i < 3; i += 1) {
      await applyResult({ client_uuid: id, status: 'FAILED' });
    }
    expect(await failedCount()).toBe(1);
  });

  it('retryFailed FAILED/CONFLICT ni PENDING ga qaytaradi', async () => {
    const a = await enqueue('sale', {}, 'a');
    await applyResult({ client_uuid: a, status: 'FAILED' });
    await retryFailed();
    const [row] = await listOutbox();
    expect(row?.status).toBe('PENDING');
    expect(row?.error).toBeNull();
  });
});
