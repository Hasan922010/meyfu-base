import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ api: { post } }));

import { db } from './db';
import { enqueue, listOutbox, markSending } from './outbox';
import { pushOutbox } from './sync';

beforeEach(async () => {
  await db.outbox.clear();
  post.mockReset();
});

describe('pushOutbox — UX B1', () => {
  it('oldingi sessiyadan qolgan SENDING operatsiyani qayta yuboradi', async () => {
    // Arrange: tab so'rov paytida yopilgan — yozuv SENDING da qolgan
    const id = await enqueue('sale', { total: 1 }, 'Sotuv · test');
    await markSending([id]);
    post.mockResolvedValue({
      data: {
        success: true,
        data: { results: [{ client_uuid: id, status: 'SENT' }], server_time: 'x' },
      },
    });

    // Act
    const res = await pushOutbox();

    // Assert
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0]?.[1] as { operations: Array<{ client_uuid: string }> };
    expect(body.operations.map((o) => o.client_uuid)).toEqual([id]);
    expect(res.sent).toBe(1);
    expect(await listOutbox()).toHaveLength(0);
  });
});
