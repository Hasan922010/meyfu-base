import { describe, expect, it } from 'vitest';

import { encodeReceipt, formatSum, toAscii, twoColumns } from './escpos';
import type { ReceiptDoc } from './receiptPdf';

const DOC: ReceiptDoc = {
  kind: 'sale',
  numberOrRef: 'AB12CD34',
  synced: false,
  date: '29.09.2026 14:05',
  distributorName: 'Ali Valiyev',
  clientName: 'Do‘kon «Baraka»',
  paymentLabel: 'Qarz',
  lines: [{ name: 'Ariel 3 kg', qty: 2, price: 125000 }],
  total: 250000,
  paid: 0,
  debt: 250000,
  dueDate: '13.10.2026',
};

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '|')).join('');
}

describe('escpos — termal chek kodlovchisi (v5 C3)', () => {
  it('o‘zbek va kirill harflarini ASCII ga o‘giradi', () => {
    expect(toAscii('Do‘kon «Baraka» — ўқ')).toBe(`Do'kon "Baraka" - o'q`);
    expect(toAscii('Шампунь')).toBe('Shampun');
  });

  it('summani bo‘sh joy bilan ajratadi', () => {
    expect(formatSum(1250000)).toBe('1 250 000');
  });

  it('ikki ustunni aniq enga joylaydi', () => {
    const line = twoColumns('Jami', '250 000', 32);
    expect(line).toHaveLength(32);
    expect(line.endsWith('250 000')).toBe(true);
  });

  it('chek init bilan boshlanib, kesish buyrug‘i bilan tugaydi', () => {
    const bytes = encodeReceipt(DOC, null, 32);

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
    const text = decode(bytes);
    expect(text).toContain("Mijoz: Do'kon \"Baraka\"");
    expect(text).toContain('#AB12CD34 (yuborilmagan)');
    expect(text).toContain('Qarz');
    expect(Array.from(bytes).every((b) => b < 128 || b === 0)).toBe(true);
  });
});
