/**
 * ESC/POS chek kodlovchisi (v5 C3) — 58/80 mm termal printerlar uchun.
 *
 * Arzon Bluetooth printerlarning ko'pchiligi faqat ASCII/CP437 ni to'g'ri chiqaradi,
 * shuning uchun matn ASCII'ga o'giriladi (o‘/g‘ → o'/g', kirill → lotin).
 * Sof funksiya — test qilinadi, qurilmaga bog'liq emas.
 */
import type { CompanyCache, ReceiptDoc } from './receiptPdf';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type PaperWidth = 32 | 48; // 58 mm — 32 belgi, 80 mm — 48 belgi

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: "'", ы: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h',
};

/** Matnni printer tushunadigan ASCII'ga o'giradi. */
export function toAscii(text: string): string {
  let out = '';
  const normalized = text
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/[–—]/g, '-');
  for (const ch of normalized) {
    const lower = ch.toLowerCase();
    const mapped = CYRILLIC[lower];
    if (mapped !== undefined) {
      out += ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    } else if (ch.charCodeAt(0) < 128) {
      out += ch;
    } else {
      out += '?';
    }
  }
  return out;
}

/** 1250000 → "1 250 000" */
export function formatSum(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Chap va o'ng matnni bitta qatorga joylaydi (kerak bo'lsa chapi qisqaradi). */
export function twoColumns(left: string, right: string, width: number): string {
  const room = width - right.length - 1;
  const l = left.length > room ? left.slice(0, Math.max(room, 0)) : left;
  return l + ' '.repeat(Math.max(width - l.length - right.length, 1)) + right;
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if ((line + ' ' + word).trim().length > width) {
      if (line) lines.push(line);
      line = word.length > width ? word.slice(0, width) : word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

class Builder {
  private readonly bytes: number[] = [ESC, 0x40]; // printerni boshlang'ich holatga

  text(value: string): this {
    for (const ch of toAscii(value)) this.bytes.push(ch.charCodeAt(0));
    this.bytes.push(LF);
    return this;
  }

  align(mode: 'left' | 'center'): this {
    this.bytes.push(ESC, 0x61, mode === 'center' ? 1 : 0);
    return this;
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  big(on: boolean): this {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00); // 2x eni va bo'yi
    return this;
  }

  feedAndCut(): Uint8Array {
    this.bytes.push(ESC, 0x64, 4, GS, 0x56, 0x42, 0x00); // 4 qator + qisman kesish
    return Uint8Array.from(this.bytes);
  }
}

/** ReceiptDoc → ESC/POS baytlar. */
export function encodeReceipt(
  doc: ReceiptDoc,
  company: CompanyCache | null,
  width: PaperWidth = 32,
): Uint8Array {
  const rule = '-'.repeat(width);
  const b = new Builder().align('center');
  if (company?.name) b.bold(true).text(company.name).bold(false);
  if (company?.phone) b.text(company.phone);
  b.bold(true)
    .text(doc.kind === 'sale' ? 'SOTUV CHEKI' : 'BUYURTMA')
    .bold(false)
    .text(`#${doc.numberOrRef}${doc.synced ? '' : ' (yuborilmagan)'}`)
    .text(doc.date)
    .align('left')
    .text(rule)
    .text(`Mijoz: ${doc.clientName}`)
    .text(`Agent: ${doc.distributorName}`)
    .text(rule);

  for (const line of doc.lines) {
    for (const part of wrap(toAscii(line.name), width)) b.text(part);
    b.text(
      twoColumns(
        `  ${line.qty} x ${formatSum(line.price)}`,
        formatSum(line.qty * line.price),
        width,
      ),
    );
  }

  // Katta shriftda har belgi 2 barobar keng — qator eni yarmiga tushadi
  b.text(rule).bold(true).big(true).text(twoColumns('JAMI', formatSum(doc.total), width / 2));
  b.big(false).bold(false);
  if (doc.paymentLabel) b.text(twoColumns("To'lov", doc.paymentLabel, width));
  if (doc.paid != null) b.text(twoColumns("To'landi", formatSum(doc.paid), width));
  if (doc.debt != null && doc.debt > 0) {
    b.text(twoColumns('Qarz', formatSum(doc.debt), width));
    if (doc.dueDate) b.text(twoColumns('Muddat', doc.dueDate, width));
  }
  if (doc.note) for (const part of wrap(toAscii(doc.note), width)) b.text(part);
  return b.align('center').text(rule).text('Xaridingiz uchun rahmat!').feedAndCut();
}
