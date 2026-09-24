import type { LocalSaleLine } from '@/offline/actions';

export interface CartLine extends LocalSaleLine {
  max: number;
}

export interface AddResult {
  cart: CartLine[];
  /** Qoldiqdan oshgani uchun kesilgan bo'lsa — yakuniy miqdor, aks holda null. */
  clampedTo: number | null;
}

/** Mashinadagi qoldiqdan savatga allaqachon olinganini ayiradi. */
export function remainingFor(available: number, cart: CartLine[], product: string): number {
  const inCart = cart.find((l) => l.product === product)?.quantity ?? 0;
  return Math.max(0, available - inCart);
}

/**
 * Qator miqdorini yozilgan qiymatga o'rnatadi (qo'shmaydi) — miqdorni klaviaturadan
 * kiritish va "−" uchun (UX M4). Butun songa keltiriladi; ≤0 yoki NaN — qator olib
 * tashlanadi; qoldiqdan oshsa kesiladi va bildiriladi.
 */
export function setLineQuantity(
  cart: CartLine[],
  line: LocalSaleLine,
  available: number,
): AddResult {
  const requested = Math.floor(line.quantity);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { cart: cart.filter((l) => l.product !== line.product), clampedTo: null };
  }
  const quantity = Math.min(available, requested);
  const next: CartLine = { ...line, quantity, max: available };
  const exists = cart.some((l) => l.product === line.product);
  return {
    cart: exists ? cart.map((l) => (l.product === line.product ? next : l)) : [...cart, next],
    clampedTo: requested > available ? available : null,
  };
}

/** Bitta qator narxini o'zgartiradi; 0 yoki noto'g'ri narx — savat o'zgarmaydi. */
export function setLinePrice(cart: CartLine[], product: string, price: number): CartLine[] {
  if (!Number.isFinite(price) || price <= 0) return cart;
  return cart.map((l) => (l.product === product ? { ...l, price } : l));
}

/**
 * Savatga qo'shadi: mahsulot savatda bo'lsa miqdorlar jamlanadi (UX M3),
 * jami qoldiqdan oshsa qoldiqqacha kesiladi va buni qaytaradi (UX M2).
 */
export function addToCart(
  cart: CartLine[],
  line: LocalSaleLine,
  available: number,
): AddResult {
  const existing = cart.find((l) => l.product === line.product);
  const requested = (existing?.quantity ?? 0) + line.quantity;
  const quantity = Math.min(available, requested);
  const next: CartLine = { ...line, quantity, max: available };

  return {
    cart: existing
      ? cart.map((l) => (l.product === line.product ? next : l))
      : [...cart, next],
    clampedTo: requested > available ? available : null,
  };
}
