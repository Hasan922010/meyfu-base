import { describe, expect, it } from 'vitest';

import { businessDateISO } from './businessDay';

// Barcha vaqtlar UTC da beriladi — Toshkent = UTC+5, ish kuni 06:00 da boshlanadi
describe('businessDateISO (UX N1)', () => {
  it('04:46 Toshkent (23:46 UTC oldingi kun) — kechagi ish kuni', () => {
    expect(businessDateISO(0, new Date('2026-09-23T23:46:00Z'))).toBe('2026-09-23');
  });

  it('05:59 Toshkent — hali kechagi ish kuni', () => {
    expect(businessDateISO(0, new Date('2026-09-24T00:59:00Z'))).toBe('2026-09-23');
  });

  it('06:00 Toshkent — yangi ish kuni', () => {
    expect(businessDateISO(0, new Date('2026-09-24T01:00:00Z'))).toBe('2026-09-24');
  });

  it('20:30 Toshkent (15:30 UTC) — o‘sha kun, UTC bilan ham bir xil', () => {
    expect(businessDateISO(0, new Date('2026-09-24T15:30:00Z'))).toBe('2026-09-24');
  });

  it('23:30 Toshkent (18:30 UTC) — o‘sha kun (UTC sanasi ham o‘sha)', () => {
    expect(businessDateISO(0, new Date('2026-09-24T18:30:00Z'))).toBe('2026-09-24');
  });

  it('kun qo‘shish ish kunidan hisoblanadi (qarz muddati +14)', () => {
    expect(businessDateISO(14, new Date('2026-09-23T23:46:00Z'))).toBe('2026-10-07');
  });

  it('oy chegarasidan o‘tadi', () => {
    // 1-oktabr 03:00 Toshkent → 30-sentabr ish kuni
    expect(businessDateISO(0, new Date('2026-09-30T22:00:00Z'))).toBe('2026-09-30');
  });
});
