import { describe, expect, it, vi } from 'vitest';

import {
  bulkSyncDataShape,
  loginDataShape,
  vanStockListShape,
} from '@/shared/api/schemas';
import { ApiShapeError, assertApiShape } from '@/shared/lib/validate';

const validLogin = {
  access: 'a.b.c',
  refresh: 'd.e.f',
  user: { id: 'u1', phone: '+998900000000', full_name: 'Test', role: 'MANAGER' },
};

describe('loginDataShape', () => {
  it('to‘g‘ri javobni qabul qiladi (qo‘shimcha maydonlar bilan ham)', () => {
    expect(() =>
      assertApiShape(loginDataShape, { ...validLogin, extra: 1 }, 'login'),
    ).not.toThrow();
  });

  it('access yo‘q — ApiShapeError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { access: _drop, ...broken } = validLogin;
    void _drop;
    expect(() => assertApiShape(loginDataShape, broken, 'login')).toThrow(
      ApiShapeError,
    );
  });

  it('data.data null bo‘lsa — ApiShapeError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => assertApiShape(loginDataShape, null, 'login')).toThrow(
      /kutilmagan javob \(login\)/,
    );
  });

  it('user.role noma‘lum — ApiShapeError', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = { ...validLogin, user: { ...validLogin.user, role: 'KING' } };
    expect(() => assertApiShape(loginDataShape, broken, 'login')).toThrow(
      ApiShapeError,
    );
  });
});

describe('bulkSyncDataShape', () => {
  it('results massiv bo‘lishi kerak', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      assertApiShape(bulkSyncDataShape, { results: 'nope' }, 'bulk-sync'),
    ).toThrow(ApiShapeError);
  });

  it('to‘g‘ri natijalar', () => {
    expect(() =>
      assertApiShape(
        bulkSyncDataShape,
        {
          results: [{ client_uuid: 'x', status: 'SENT', server_id: '1' }],
          server_time: '2026-09-09T00:00:00Z',
        },
        'bulk-sync',
      ),
    ).not.toThrow();
  });
});

describe('vanStockListShape', () => {
  it('quantity string yoki number bo‘lishi mumkin', () => {
    expect(() =>
      assertApiShape(
        vanStockListShape,
        [
          { product: 'p1', quantity: '5.000' },
          { product: 'p2', quantity: 3 },
        ],
        'sync/van-stock',
      ),
    ).not.toThrow();
  });
});
