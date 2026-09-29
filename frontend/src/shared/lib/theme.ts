// Yorug' / qorong'i tema (CLAUDE.md 20, v5: B7). Tailwind `darkMode: 'class'` —
// `<html class="dark">`. Tanlov qurilmada saqlanadi; "system" — OS sozlamasi.
export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'meyfu.theme';
const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

export function getTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // saqlash yopiq (maxfiy rejim) — tizim sozlamasi
  }
  return 'system';
}

export function applyTheme(choice: ThemeChoice = getTheme()): void {
  const dark = choice === 'dark' || (choice === 'system' && Boolean(media()?.matches));
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // saqlanmasa ham joriy seans uchun qo'llanadi
  }
  applyTheme(choice);
}

/** Ilova ishga tushganda bir marta: tema va OS o'zgarishini kuzatish. */
export function initTheme(): void {
  applyTheme();
  media()?.addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });
}
