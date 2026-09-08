// CLAUDE.md 20: valyuta "1 250 000 so'm", sana dd.MM.yyyy

/** Butun qismni 3 xonadan bo'sh joy bilan ajratadi: 1250000 -> "1 250 000". */
export function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const _ONES = [
  '', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz",
];
const _TENS = [
  '', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish',
  'sakson', "to'qson",
];
const _SCALES = ['', 'ming', 'million', 'milliard', 'trillion'];

function _under1000(n: number): string {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(h === 1 ? 'yuz' : `${_ONES[h]} yuz`);
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  if (t) out.push(_TENS[t] as string);
  if (o) out.push(_ONES[o] as string);
  return out.join(' ');
}

/** Sonni o'zbekcha so'z bilan: 1250000 -> "bir million ikki yuz ellik ming". */
export function numberToWordsUz(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'nol';
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i] ?? 0;
    if (g === 0) continue;
    const scale = _SCALES[i] ?? '';
    if (scale === 'ming' && g === 1) parts.push('ming');
    else parts.push(scale ? `${_under1000(g)} ${scale}` : _under1000(g));
  }
  return (value < 0 ? 'minus ' : '') + parts.join(' ');
}

/**
 * Pul summasi. So'mda tiyin ishlatilmaydi — butun songacha yaxlitlanadi.
 * Lokaldan mustaqil (ICU ajratgichlariga bog'liq emas).
 */
export function money(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  const sign = n < 0 ? '−' : '';
  return `${sign}${groupThousands(String(Math.round(Math.abs(n))))} so'm`;
}

/** Miqdor — kasr qism bo'lsa saqlanadi (masalan kg): 3 -> "3", 2.5 -> "2.5". */
export function qty(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  const sign = n < 0 ? '−' : '';
  const parts = Math.abs(n).toFixed(3).replace(/\.?0+$/, '').split('.');
  const int = parts[0] ?? '0';
  const frac = parts[1];
  return `${sign}${groupThousands(int)}${frac ? `.${frac}` : ''}`;
}

export function dateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
