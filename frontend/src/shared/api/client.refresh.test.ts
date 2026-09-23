import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/authStore';

/** Server: faqat `valid` access tokenni qabul qiladi, qolganiga 401. */
function fakeAdapter(validAccess: () => string) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const auth = config.headers.get('Authorization');
    const response = { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    if (auth === `Bearer ${validAccess()}`) return Promise.resolve(response);
    const err = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config);
    err.response = { ...response, status: 401, statusText: 'Unauthorized' };
    return Promise.reject(err);
  };
}

describe('refresh token rotatsiyasi (UX: har ~30 daqiqada logout)', () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    useAuthStore.getState().setSession({
      access: 'access-0',
      refresh: 'refresh-0',
      user: { id: 'u', full_name: 'T', role: 'DISTRIBUTOR' } as never,
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it('refresh javobidagi yangi refresh tokenni saqlaydi va keyingi safar o‘shani yuboradi', async () => {
    // Arrange: server har refresh'da yangi juftlik beradi (ROTATE_REFRESH_TOKENS)
    let valid = 'access-1';
    api.defaults.adapter = fakeAdapter(() => valid);
    const post = vi.spyOn(axios, 'post').mockImplementation((_url, body) => {
      const { refresh } = body as { refresh: string };
      const n = Number(refresh.split('-')[1]) + 1;
      return Promise.resolve({ data: { access: `access-${n}`, refresh: `refresh-${n}` } });
    });

    // Act 1: eskirgan access → 401 → refresh-0 bilan yangilanadi
    await api.get('/x');

    // Act 2: access yana eskiradi → 401 → endi refresh-1 yuborilishi kerak
    valid = 'access-2';
    await api.get('/x');

    // Assert
    expect(post.mock.calls.map((c) => (c[1] as { refresh: string }).refresh)).toEqual([
      'refresh-0',
      'refresh-1',
    ]);
    expect(useAuthStore.getState().refresh).toBe('refresh-2');
    expect(useAuthStore.getState().access).toBe('access-2');
  });

  it('javobda refresh bo‘lmasa, eskisini saqlab qoladi', async () => {
    api.defaults.adapter = fakeAdapter(() => 'access-new');
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'access-new' } });

    await api.get('/x');

    expect(useAuthStore.getState().refresh).toBe('refresh-0');
    expect(useAuthStore.getState().access).toBe('access-new');
  });
});
