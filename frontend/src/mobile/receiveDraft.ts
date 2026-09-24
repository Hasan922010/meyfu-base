// Tovar qabuli formasining lokal qoralamasi (audit K6): omborchi 10–20 qatorni
// kiritib, tasodifan boshqa bo'limga o'tsa, qaytganda hammasi joyida turadi.
// Faqat qulaylik — storage yopiq/bo'sh bo'lsa forma oddiygina bo'sh ochiladi.

export interface ReceiveDraftRow {
  product: string;
  name: string;
  unit: string;
  quantity: string;
  price: string;
}

export interface ReceiveDraft {
  supplier: string;
  warehouse: string;
  invoice: string;
  rows: ReceiveDraftRow[];
}

const KEY = 'meyfu:receive-draft';

function isEmpty(d: ReceiveDraft): boolean {
  return !d.supplier && !d.warehouse && !d.invoice && d.rows.length === 0;
}

export function loadReceiveDraft(): ReceiveDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ReceiveDraft;
    return Array.isArray(d.rows) ? d : null;
  } catch {
    return null;
  }
}

export function saveReceiveDraft(d: ReceiveDraft): void {
  try {
    if (isEmpty(d)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // storage yopiq (private rejim) — qoralamasiz ishlashda davom etamiz
  }
}

export function clearReceiveDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // e'tiborsiz
  }
}
