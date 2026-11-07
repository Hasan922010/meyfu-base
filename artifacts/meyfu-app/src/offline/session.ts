import { queryClient } from '@/app/queryClient';
import { clearReceiveDraft } from '@/mobile/receiveDraft';
import { useAuthStore } from '@/shared/store/authStore';

import { db, getMeta } from './db';

// Lokal ma'lumot foydalanuvchiga tegishli (audit FE-101). Umumiy telefonda B kirsa,
// A ning mijozlari/qarzlari ko'rinmasin va A ning yuborilmagan operatsiyalari
// B tokeni bilan serverga ketmasin. Outbox o'chirilmaydi — u egasi bilan
// belgilangan (`owner_id`) va A qayta kirganda yuboriladi.

const OWNER_KEY = 'owner_id';

/** Foydalanuvchiga bog'liq kesh jadvallari (katalog ham — filial narxlari). */
async function clearReferenceTables(): Promise<void> {
  await Promise.all([
    db.products.clear(),
    db.clients.clear(),
    db.van_stock.clear(),
    db.orders.clear(),
  ]);
}

/**
 * Kirgan foydalanuvchini lokal bazaga bog'laydi: egasiz (eski versiyadagi)
 * operatsiyalarni oldingi egaga yozadi; egasi almashgan bo'lsa keshni tozalaydi.
 */
export async function bindLocalSession(userId: string): Promise<void> {
  const previous = await getMeta(OWNER_KEY);
  await db.transaction(
    'rw',
    [db.outbox, db.meta, db.products, db.clients, db.van_stock, db.orders],
    async () => {
      await db.outbox
        .filter((op) => !op.owner_id)
        .modify({ owner_id: previous ?? userId });
      if (previous && previous !== userId) {
        await clearReferenceTables();
        await db.meta.clear();
      }
      await db.meta.put({ key: OWNER_KEY, value: userId });
    },
  );
}

/** Chiqishda (qo'lda, PIN bloki yoki sessiya tugashi) — ekrandagi va lokal kesh. */
export async function resetLocalSession(): Promise<void> {
  queryClient.clear();
  clearReceiveDraft();
  // meta ham (egasi, oxirgi sinxron vaqti): keyingi kirishda bind hech narsani
  // o'chirmaydi va yangi foydalanuvchining pull'i bilan poygaga kirmaydi
  await Promise.all([clearReferenceTables(), db.meta.clear()]);
}

function report(err: unknown): void {
  console.error('[session] lokal sessiyani yangilab bo‘lmadi', err);
}

/** Barcha kirish/chiqish yo'llarini bitta joyda kuzatadi — `main.tsx` chaqiradi. */
export function watchAuthSession(): void {
  const initial = useAuthStore.getState().user?.id;
  if (initial) bindLocalSession(initial).catch(report);

  useAuthStore.subscribe((state, prev) => {
    const now = state.user?.id;
    const before = prev.user?.id;
    if (now === before) return;
    if (now) bindLocalSession(now).catch(report);
    else resetLocalSession().catch(report);
  });
}
