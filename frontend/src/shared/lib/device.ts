// Qurilma identifikatori — Sync log'da "qaysi telefondan" ko'rinishi uchun (audit FE-107).
// Faqat tasodifiy UUID: shaxsiy ma'lumot yoki qurilma barmoq izi emas (CLAUDE.md 8).

const KEY = 'meyfu:device-id';
let memo: string | null = null;

export function deviceId(): string {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY);
    if (!memo) {
      memo = crypto.randomUUID();
      localStorage.setItem(KEY, memo);
    }
  } catch {
    // storage yopiq (private rejim) — sessiya davomida bitta ID
    memo = memo ?? crypto.randomUUID();
  }
  return memo;
}
