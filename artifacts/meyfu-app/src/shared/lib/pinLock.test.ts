import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_ATTEMPTS,
  clearPin,
  hasPin,
  isUnlocked,
  isValidPin,
  lock,
  remainingAttempts,
  setPin,
  verifyPin,
} from './pinLock';

const USER = 'user-1';

describe('pinLock — qurilmadagi PIN qulfi', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('faqat 4–6 raqamli PIN qabul qilinadi', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12ab')).toBe(false);
  });

  it("PIN o'zi saqlanmaydi — faqat hash", async () => {
    await setPin(USER, '4821');

    expect(hasPin(USER)).toBe(true);
    expect(localStorage.getItem(`meyfu.pin.${USER}`)).not.toContain('4821');
  });

  it("to'g'ri PIN ochadi, xato PIN urinishni kamaytiradi", async () => {
    await setPin(USER, '4821');
    lock();

    expect(await verifyPin(USER, '0000')).toBe(false);
    expect(remainingAttempts(USER)).toBe(MAX_ATTEMPTS - 1);
    expect(isUnlocked()).toBe(false);

    expect(await verifyPin(USER, '4821')).toBe(true);
    expect(isUnlocked()).toBe(true);
    expect(remainingAttempts(USER)).toBe(MAX_ATTEMPTS);
  });

  it("5 marta xato — PIN o'chiriladi (parol bilan kirish kerak)", async () => {
    await setPin(USER, '4821');
    let result: boolean | 'locked-out' = false;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      result = await verifyPin(USER, '0000');
    }

    expect(result).toBe('locked-out');
    expect(hasPin(USER)).toBe(false);
  });

  it("PIN o'chirilsa qulf yo'q", async () => {
    await setPin(USER, '4821');
    clearPin(USER);

    expect(hasPin(USER)).toBe(false);
    expect(await verifyPin(USER, 'anything')).toBe(true);
  });
});
