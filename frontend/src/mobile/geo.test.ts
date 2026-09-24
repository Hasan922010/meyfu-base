import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GPS_SAVE_WAIT_MS, usePrefetchedCoords, waitAtMost } from './geo';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubGeolocation(
  impl: (ok: (p: GeolocationPosition) => void) => void,
): ReturnType<typeof vi.fn> {
  const getCurrentPosition = vi.fn(impl);
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

describe('usePrefetchedCoords (UX N4)', () => {
  it('ekran ochilganda GPS ni boshlaydi va saqlashda natijani beradi', async () => {
    const gps = stubGeolocation((ok) =>
      ok({ coords: { latitude: 41.3, longitude: 69.24 } } as GeolocationPosition),
    );

    const { result } = renderHook(() => usePrefetchedCoords(true));

    expect(gps).toHaveBeenCalledTimes(1);
    await expect(result.current()).resolves.toEqual({
      latitude: '41.300000',
      longitude: '69.240000',
    });
  });

  it('o‘chiq bo‘lsa GPS ni boshlamaydi', () => {
    const gps = stubGeolocation(() => {});

    renderHook(() => usePrefetchedCoords(false));

    expect(gps).not.toHaveBeenCalled();
  });

  it('GPS javob bermasa saqlash belgilangan vaqtdan ortiq kutmaydi', async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {});
    const { result } = renderHook(() => usePrefetchedCoords(true));

    const coords = result.current();
    await vi.advanceTimersByTimeAsync(GPS_SAVE_WAIT_MS);

    await expect(coords).resolves.toBeNull();
  });
});

describe('waitAtMost (UX m3 — sotuv GPS ni kutib qolmasin)', () => {
  it('va’da vaqtida tugasa uning qiymatini qaytaradi', async () => {
    const coords = { latitude: '41.300000', longitude: '69.240000' };

    await expect(waitAtMost(Promise.resolve(coords), 300)).resolves.toEqual(coords);
  });

  it('va’da kechiksa belgilangan vaqtdan keyin null qaytaradi', async () => {
    vi.useFakeTimers();
    const never = new Promise<{ latitude: string; longitude: string } | null>(() => {});

    const result = waitAtMost(never, 300);
    await vi.advanceTimersByTimeAsync(300);

    await expect(result).resolves.toBeNull();
  });
});
