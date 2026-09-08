/**
 * Chek / buyurtma PDF'i — mobil klientda, OFFLINE (v4 T4).
 *
 * jspdf + qisqartirilgan DejaVuSans (lotin/kirill). Faqat lokal sotuv ma'lumoti +
 * keshlangan kompaniya rekvizitlaridan foydalanadi — internet shart emas.
 * 80mm termal uslub, balandligi tarkibga qarab avtomatik.
 */
import { jsPDF } from 'jspdf';

import { DEJAVU_SUBSET_B64 } from './fonts/dejavuSubset';

export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
}

export interface ReceiptDoc {
  kind: 'sale' | 'order';
  numberOrRef: string;
  synced: boolean;
  date: string;
  distributorName: string;
  clientName: string;
  paymentLabel?: string | undefined;
  lines: ReceiptLine[];
  total: number;
  paid?: number | null | undefined;
  debt?: number | null | undefined;
  dueDate?: string | null | undefined;
  note?: string | undefined;
}

export interface CompanyCache {
  name: string;
  inn: string;
  address: string;
  phone: string;
  bank_details: string;
  logo: string | null;
  stamp: string | null;
}

const W = 80; // mm
const M = 5; // chap/o'ng margin
const INNER = W - M * 2;
const FONT = 'DejaVu';

function money(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function imgType(dataUri: string): 'PNG' | 'JPEG' {
  return dataUri.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
}

function wrap(doc: jsPDF, text: string, width: number): string[] {
  const out: unknown = doc.splitTextToSize(text, width);
  return Array.isArray(out) ? (out as string[]) : [String(out)];
}

/** Chizadi va oxirgi y (mm) ni qaytaradi. */
function render(doc: jsPDF, r: ReceiptDoc, company: CompanyCache | null): number {
  doc.setFont(FONT, 'normal');
  let y = 6;

  const center = (text: string, size: number, gap = 4): void => {
    doc.setFontSize(size);
    for (const ln of wrap(doc, text, INNER)) {
      doc.text(ln, W / 2, y, { align: 'center' });
      y += gap;
    }
  };
  const rule = (): void => {
    y += 1;
    doc.setLineWidth(0.15);
    doc.line(M, y, W - M, y);
    y += 3;
  };
  const row = (l: string, rr: string, size = 8): void => {
    doc.setFontSize(size);
    doc.text(l, M, y);
    doc.text(rr, W - M, y, { align: 'right' });
    y += size * 0.5;
  };

  if (company?.logo) {
    try {
      doc.addImage(company.logo, imgType(company.logo), W / 2 - 9, y, 18, 18);
      y += 20;
    } catch {
      /* rasm buzuq — tashlab ketamiz */
    }
  }
  if (company?.name) center(company.name, 10, 4.5);
  const meta = [
    company?.inn ? `STIR: ${company.inn}` : '',
    company?.address ?? '',
    company?.phone ?? '',
  ].filter(Boolean);
  if (meta.length) center(meta.join(' · '), 7, 3.4);

  rule();
  center(r.kind === 'order' ? 'BUYURTMA' : 'CHEK / SOTUV', 10, 4.6);
  center(`№ ${r.numberOrRef}`, 8, 3.6);
  if (!r.synced) center('(sinxrondan oldin)', 6.5, 3);
  y += 1;

  doc.setFontSize(7.5);
  doc.text(`Sana: ${r.date}`, M, y);
  y += 3.6;
  doc.text(`Sotuvchi: ${r.distributorName}`, M, y);
  y += 3.6;
  for (const ln of wrap(doc, `Mijoz: ${r.clientName}`, INNER)) {
    doc.text(ln, M, y);
    y += 3.6;
  }

  rule();
  doc.setFontSize(7.5);
  doc.text('Tovar', M, y);
  doc.text('Summa', W - M, y, { align: 'right' });
  y += 3.4;

  for (const line of r.lines) {
    const amount = line.qty * line.price;
    for (const ln of wrap(doc, line.name, INNER)) {
      doc.text(ln, M, y);
      y += 3.3;
    }
    doc.setFontSize(7);
    doc.text(`${line.qty} × ${money(line.price)}`, M, y);
    doc.setFontSize(7.5);
    doc.text(money(amount), W - M, y, { align: 'right' });
    y += 4;
  }

  rule();
  row('JAMI', `${money(r.total)} so'm`, 9);
  if (r.paid != null && r.paid > 0) row("To'landi", money(r.paid));
  if (r.debt != null && r.debt > 0) {
    row('Qarz', money(r.debt));
    if (r.dueDate) row('Muddat', r.dueDate, 7);
  }
  if (r.paymentLabel) row("To'lov turi", r.paymentLabel, 7);
  if (r.note) {
    y += 1;
    doc.setFontSize(7);
    for (const ln of wrap(doc, `Izoh: ${r.note}`, INNER)) {
      doc.text(ln, M, y);
      y += 3.2;
    }
  }

  y += 3;
  if (company?.stamp) {
    try {
      doc.addImage(company.stamp, imgType(company.stamp), W - M - 22, y, 22, 22);
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(9);
  doc.text('Rahmat!', M, y + 10);
  y += 24;

  return y;
}

/** Chek PDF Blob'ini qaytaradi. Offline ishlaydi. */
export function buildReceiptPdf(
  r: ReceiptDoc,
  company: CompanyCache | null,
): Blob {
  // 1-o'tish: balandlikni o'lchash
  const probe = new jsPDF({ unit: 'mm', format: [W, 400], compress: true });
  probe.addFileToVFS('DejaVu.ttf', DEJAVU_SUBSET_B64);
  probe.addFont('DejaVu.ttf', FONT, 'normal');
  const height = Math.max(60, render(probe, r, company) + 4);

  // 2-o'tish: aniq o'lchamli hujjat
  const doc = new jsPDF({ unit: 'mm', format: [W, height], compress: true });
  doc.addFileToVFS('DejaVu.ttf', DEJAVU_SUBSET_B64);
  doc.addFont('DejaVu.ttf', FONT, 'normal');
  render(doc, r, company);
  return doc.output('blob');
}
