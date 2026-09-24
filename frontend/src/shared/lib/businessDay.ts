// Ish kuni (CLAUDE.md 5.4): 06:00 dan keyingi kun 05:59 gacha bitta kun, Asia/Tashkent.
// Backend: apps.core.business_day.business_date() + BUSINESS_DAY_START_HOUR — mos bo'lishi shart.
// Avval `toISOString().slice(0, 10)` (UTC) ishlatilardi: Toshkentda 05:00 gacha
// hujjatlar noto'g'ri kunga tushardi (UX audit N1).

export const BUSINESS_DAY_START_HOUR = 6;
const TIME_ZONE = 'Asia/Tashkent';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// en-CA → "YYYY-MM-DD"
const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Hozirgi (yoki `now`) ish kuni + `plusDays`, "YYYY-MM-DD" ko'rinishida.
 * Toshkentda yozgi vaqt yo'q, shuning uchun kunni ms bilan qo'shish xavfsiz.
 */
export function businessDateISO(plusDays = 0, now: Date = new Date()): string {
  const shifted = now.getTime() - BUSINESS_DAY_START_HOUR * HOUR_MS + plusDays * DAY_MS;
  return ymd.format(new Date(shifted));
}
