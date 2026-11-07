// Qurilmadagi PIN qulfi (spetsifikatsiya 12.1, v5: B4). Offline ishlaydi: PIN serverga
// yuborilmaydi — PBKDF2 (WebCrypto) hash + tuz qurilmada saqlanadi. 5 marta xato — chiqish.
const KEY = (userId: string): string => `meyfu.pin.${userId}`;
const UNLOCKED = 'meyfu.pin.unlocked';
export const MAX_ATTEMPTS = 5;
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

interface Stored {
  salt: string;
  hash: string;
  failed: number;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    // TS 5.7+: Uint8Array<ArrayBufferLike> ≠ BufferSource — nusxa ArrayBuffer'ga bog'lanadi
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 150_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toB64(bits);
}

function read(userId: string): Stored | null {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(userId: string, value: Stored | null): void {
  try {
    if (value) localStorage.setItem(KEY(userId), JSON.stringify(value));
    else localStorage.removeItem(KEY(userId));
  } catch {
    // saqlash yopiq — PIN qulfi ishlamaydi, oddiy parol bilan kirish qoladi
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function hasPin(userId: string): boolean {
  return read(userId) !== null;
}

export async function setPin(userId: string, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  write(userId, { salt: toB64(salt), hash: await derive(pin, salt), failed: 0 });
  markUnlocked();
}

export function clearPin(userId: string): void {
  write(userId, null);
}

/** `true` — to'g'ri; `false` — xato; `'locked-out'` — urinishlar tugadi (PIN o'chiriladi). */
export async function verifyPin(userId: string, pin: string): Promise<boolean | 'locked-out'> {
  const stored = read(userId);
  if (!stored) return true;
  const ok = (await derive(pin, fromB64(stored.salt))) === stored.hash;
  if (ok) {
    write(userId, { ...stored, failed: 0 });
    markUnlocked();
    return true;
  }
  const failed = stored.failed + 1;
  if (failed >= MAX_ATTEMPTS) {
    clearPin(userId);
    return 'locked-out';
  }
  write(userId, { ...stored, failed });
  return false;
}

export function remainingAttempts(userId: string): number {
  return MAX_ATTEMPTS - (read(userId)?.failed ?? 0);
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCKED, String(Date.now()));
  } catch {
    // e'tiborsiz
  }
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCKED) !== null;
  } catch {
    return false;
  }
}

export function lock(): void {
  try {
    sessionStorage.removeItem(UNLOCKED);
  } catch {
    // e'tiborsiz
  }
}
