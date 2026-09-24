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

  describe('UX N2 — refresh muvaffaqiyatsiz bo‘lsa', () => {
    const realLocation = window.location;
    const assign = vi.fn();

    beforeEach(() => {
      assign.mockReset();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, pathname: '/m', assign },
      });
      api.defaults.adapter = fakeAdapter(() => 'never-valid');
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
    });

    function refreshFailsWith(err: AxiosError): void {
      vi.spyOn(axios, 'post').mockRejectedValue(err);
    }

    it('tarmoq xatosida sessiya saqlanadi va login sahifasiga o‘tkazilmaydi', async () => {
      refreshFailsWith(new AxiosError('Network Error', 'ERR_NETWORK'));

      await expect(api.get('/x')).rejects.toBeInstanceOf(AxiosError);

      expect(useAuthStore.getState().refresh).toBe('refresh-0');
      expect(useAuthStore.getState().access).toBe('access-0');
      expect(assign).not.toHaveBeenCalled();
    });

    it('server 5xx qaytarsa ham sessiya saqlanadi', async () => {
      const err = new AxiosError('Bad Gateway', 'ERR_BAD_RESPONSE');
      err.response = { data: {}, status: 502, statusText: '', headers: {}, config: {} as never };
      refreshFailsWith(err);

      await expect(api.get('/x')).rejects.toBeInstanceOf(AxiosError);

      expect(useAuthStore.getState().refresh).toBe('refresh-0');
      expect(assign).not.toHaveBeenCalled();
    });

    it('server refresh tokenni rad etsa (401) sessiya tozalanadi va login sahifasiga o‘tadi', async () => {
      const err = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST');
      err.response = { data: {}, status: 401, statusText: '', headers: {}, config: {} as never };
      refreshFailsWith(err);

      await expect(api.get('/x')).rejects.toBeInstanceOf(AxiosError);

      expect(useAuthStore.getState().refresh).toBeNull();
      expect(assign).toHaveBeenCalledWith('/login');
    });
  });

  describe('Ikki tab — refresh token rotatsiyasi', () => {
    /** Boshqa tab localStorage'ga yozgandek (zustand persist formati). */
    function otherTabWrites(access: string, refresh: string): void {
      const user = useAuthStore.getState().user;
      localStorage.setItem(
        'meyfu-auth',
        JSON.stringify({ state: { access, refresh, user }, version: 0 }),
      );
    }

    it('boshqa tab allaqachon yangilagan bo‘lsa, eski tokenni yubormaydi va yangisini ishlatadi', async () => {
      // Arrange: bu tab xotirasida access-0/refresh-0; boshqa tab 5-juftlikka o'tgan
      otherTabWrites('access-5', 'refresh-5');
      api.defaults.adapter = fakeAdapter(() => 'access-5');
      const post = vi.spyOn(axios, 'post');

      // Act
      await api.get('/x');

      // Assert: eski (qora ro'yxatdagi) refresh-0 serverga umuman yuborilmadi
      expect(post).not.toHaveBeenCalled();
      expect(useAuthStore.getState().refresh).toBe('refresh-5');
      expect(useAuthStore.getState().access).toBe('access-5');
    });

    it('refresh 401 bo‘lsa-yu, shu paytda boshqa tab almashtirgan bo‘lsa — sessiya saqlanadi', async () => {
      api.defaults.adapter = fakeAdapter(() => 'access-7');
      vi.spyOn(axios, 'post').mockImplementation(() => {
        // Poyga: bizning so'rovimiz ketayotganda boshqa tab rotatsiyani yakunladi
        otherTabWrites('access-7', 'refresh-7');
        const err = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST');
        err.response = { data: {}, status: 401, statusText: '', headers: {}, config: {} as never };
        return Promise.reject(err);
      });

      await api.get('/x');

      expect(useAuthStore.getState().refresh).toBe('refresh-7');
      expect(useAuthStore.getState().access).toBe('access-7');
    });

    it('boshqa tab yozganda (storage hodisasi) bu tab xotirasi yangilanadi', async () => {
      otherTabWrites('access-9', 'refresh-9');

      window.dispatchEvent(new StorageEvent('storage', { key: 'meyfu-auth' }));
      await Promise.resolve();

      expect(useAuthStore.getState().refresh).toBe('refresh-9');
    });
  });

  it('javobda refresh bo‘lmasa, eskisini saqlab qoladi', async () => {
    api.defaults.adapter = fakeAdapter(() => 'access-new');
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'access-new' } });

    await api.get('/x');

    expect(useAuthStore.getState().refresh).toBe('refresh-0');
    expect(useAuthStore.getState().access).toBe('access-new');
  });
});
