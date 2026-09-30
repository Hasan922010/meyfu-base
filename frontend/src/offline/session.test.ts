import { beforeEach, describe, expect, it } from 'vitest';

import { queryClient } from '@/app/queryClient';
import { useAuthStore } from '@/shared/store/authStore';
import type { User } from '@/shared/types/api';

import { db } from './db';
import { dueOps, enqueue, unsentCount } from './outbox';
import { bindLocalSession, resetLocalSession } from './session';

function loginAs(id: string): void {
  useAuthStore.setState({ user: { id } as User });
}

const CLIENT = {
  id: 'c1', name: "Do'kon", owner_name: '', phone: '', address: '', route: null,
  debt_limit: '0', current_debt: '500000', is_blocked: false,
};

beforeEach(async () => {
  await Promise.all([db.outbox.clear(), db.clients.clear(), db.meta.clear()]);
  queryClient.clear();
  useAuthStore.setState({ user: null });
});

describe('audit FE-101 — lokal ma’lumot foydalanuvchiga tegishli', () => {
  it('A ning yuborilmagan sotuvi B kirganda yuborilmaydi, A qaytganda yuboriladi', async () => {
    // Arrange
    loginAs('user-a');
    await enqueue('sale', { total: 1 }, 'Sotuv · A');

    // Act
    loginAs('user-b');
    const dueForB = await dueOps();
    const unsentForB = await unsentCount();
    loginAs('user-a');
    const dueForA = await dueOps();

    // Assert
    expect(dueForB).toHaveLength(0);
    expect(unsentForB).toBe(0);
    expect(dueForA).toHaveLength(1);
  });

  it('boshqa foydalanuvchi kirsa oldingisining mijozlari o‘chiriladi', async () => {
    await bindLocalSession('user-a');
    await db.clients.put(CLIENT);

    await bindLocalSession('user-b');

    expect(await db.clients.count()).toBe(0);
  });

  it('o‘sha foydalanuvchi qayta kirsa kesh saqlanadi', async () => {
    await bindLocalSession('user-a');
    await db.clients.put(CLIENT);

    await bindLocalSession('user-a');

    expect(await db.clients.count()).toBe(1);
  });

  it('eski versiyadagi egasiz operatsiyalar oldingi egaga yoziladi', async () => {
    await db.meta.put({ key: 'owner_id', value: 'user-a' });
    await db.outbox.put({
      client_uuid: 'legacy', type: 'sale', payload: {}, summary: '', created_at: 1,
      last_attempt_at: null, attempts: 0, status: 'PENDING', error: null,
    });

    await bindLocalSession('user-b');

    expect((await db.outbox.get('legacy'))?.owner_id).toBe('user-a');
  });

  it('chiqishda mijozlar keshi va so‘rovlar keshi tozalanadi, navbat qoladi', async () => {
    loginAs('user-a');
    await enqueue('sale', { total: 1 }, 'Sotuv · A');
    await db.clients.put(CLIENT);
    queryClient.setQueryData(['sales'], [{ id: 's1' }]);

    await resetLocalSession();

    expect(await db.clients.count()).toBe(0);
    expect(queryClient.getQueryData(['sales'])).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
  });
});
