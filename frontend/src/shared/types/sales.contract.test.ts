import { describe, expect, it } from 'vitest';

import type { Debt, PaymentType, Sale, SaleItem, SaleStatus } from './sales';

// Audit API-001: bu tekshiruvlar KOMPILYATSIYA vaqtida ishlaydi (tsc -b / build).
// Serializer maydonlari o'zgarsa yoki `gen:api` eskirsa — tsc yiqiladi.

function saleContract(s: Sale, i: SaleItem, d: Debt): boolean {
  // avval yetishmagan maydonlar (API-001):
  const saleFields: [
    string, // discount_amount
    string | null, // order
    string | null, // order_number
    string | null, // latitude
    string | null, // client_uuid
    boolean, // is_synced
    string | null, // device_time
  ] = [
    s.discount_amount,
    s.order,
    s.order_number,
    s.latitude,
    s.client_uuid,
    s.is_synced,
    s.device_time,
  ];
  const itemDiscount: string | undefined = i.discount_percent;
  const debtSaleNumber: string | null = d.sale_number;
  const pt: PaymentType = 'NAQD';
  const st: SaleStatus = 'COMPLETED';
  return (
    saleFields.length === 7 &&
    typeof itemDiscount !== 'number' &&
    debtSaleNumber !== undefined &&
    pt === 'NAQD' &&
    st === 'COMPLETED'
  );
}

describe('sales tiplar kontrakti (API-001)', () => {
  it('kompilyatsiyada tekshiriladi', () => {
    expect(typeof saleContract).toBe('function');
  });
});
