import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitAtMost } from './geo';

afterEach(() => {
  vi.useRealTimers();
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
