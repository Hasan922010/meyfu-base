import type { InventoryCountItem, InventoryItemInput } from '@/shared/types/warehouse';

/** Tahrirlanayotgan haqiqiy qoldiqlar: itemId → matn ('' — sanalmagan). */
export type Drafts = Readonly<Record<string, string>>;

export type RowFilter = 'all' | 'diff' | 'uncounted';

/** Qatorning joriy (tahrirdagi yoki saqlangan) haqiqiy qoldig'i; `null` — sanalmagan. */
export function actualOf(item: InventoryCountItem, drafts: Drafts): string | null {
  const draft = drafts[item.id];
  if (draft === undefined) return item.actual_qty;
  return draft.trim() === '' ? null : draft;
}

export function differenceOf(item: InventoryCountItem, drafts: Drafts): number | null {
  const actual = actualOf(item, drafts);
  return actual === null ? null : Number(actual) - Number(item.expected_qty);
}

export interface InventorySummary {
  counted: number;
  uncounted: number;
  surplusAmount: number;
  shortageAmount: number;
}

export function summarize(items: InventoryCountItem[], drafts: Drafts): InventorySummary {
  return items.reduce<InventorySummary>(
    (acc, item) => {
      const diff = differenceOf(item, drafts);
      if (diff === null) return { ...acc, uncounted: acc.uncounted + 1 };
      const amount = diff * Number(item.cost_price);
      return {
        ...acc,
        counted: acc.counted + 1,
        surplusAmount: acc.surplusAmount + Math.max(amount, 0),
        shortageAmount: acc.shortageAmount + Math.min(amount, 0),
      };
    },
    { counted: 0, uncounted: 0, surplusAmount: 0, shortageAmount: 0 },
  );
}

function sameQty(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return Number(a) === Number(b);
}

/** Saqlangandan farq qiluvchi qatorlar — serverga faqat shular yuboriladi. */
export function changedRows(items: InventoryCountItem[], drafts: Drafts): InventoryItemInput[] {
  return items
    .filter((item) => item.id in drafts && !sameQty(actualOf(item, drafts), item.actual_qty))
    .map((item) => ({ id: item.id, actual_qty: actualOf(item, drafts) }));
}

/**
 * "Hisobni yangilash"dan keyin hisobdagi qoldig'i o'zgargan, lekin allaqachon
 * sanalgan qatorlar — farq endi boshqacha, foydalanuvchi qayta ko'rib chiqsin.
 */
export function rebasedCountedRows(
  before: InventoryCountItem[],
  after: InventoryCountItem[],
): InventoryCountItem[] {
  const previous = new Map(before.map((item) => [item.id, item.expected_qty]));
  return after.filter((item) => {
    const old = previous.get(item.id);
    return item.actual_qty !== null && old !== undefined && Number(old) !== Number(item.expected_qty);
  });
}

export function filterRows(
  items: InventoryCountItem[],
  drafts: Drafts,
  filter: RowFilter,
  search: string,
): InventoryCountItem[] {
  const needle = search.trim().toLowerCase();
  return items.filter((item) => {
    if (
      needle &&
      !item.product_name.toLowerCase().includes(needle) &&
      !item.product_sku.toLowerCase().includes(needle)
    ) {
      return false;
    }
    const diff = differenceOf(item, drafts);
    if (filter === 'uncounted') return diff === null;
    if (filter === 'diff') return diff !== null && diff !== 0;
    return true;
  });
}

/**
 * Saqlangan qoralamalarni olib tashlaydi — saqlash ketayotganda kiritilgan
 * (yuborilgandan farq qiladigan) qiymatlar qoladi (audit FE-111).
 */
export function dropSaved(drafts: Drafts, sent: Drafts): Drafts {
  return Object.fromEntries(
    Object.entries(drafts).filter(([id, value]) => sent[id] !== value),
  );
}
