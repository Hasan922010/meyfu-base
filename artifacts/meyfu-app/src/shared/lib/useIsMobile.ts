import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';
const KEY = 'meyfu.forceDesktop';

function subscribe(cb: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', cb);
  window.addEventListener('storage', cb);
  return () => {
    mql.removeEventListener('change', cb);
    window.removeEventListener('storage', cb);
  };
}

function snapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Ekran tor (telefon) — <768px. SSR yo'q, doim brauzer. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Foydalanuvchi telefonda ham desktop admin panelini majburan tanladi. */
export function isDesktopForced(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setDesktopForced(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
