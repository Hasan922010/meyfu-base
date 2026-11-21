import { describe, expect, it } from 'vitest';

import type { Order } from '@/shared/api/orders';

import { orderToReceipt } from './orderReceipt';
import { buildReceiptPdf } from './receiptPdf';

describe('orderToReceipt', () => {
  it('"O‘tkazma" to‘lov niyatini chekda ko‘rsatadi (avval bo‘sh chiqardi)', () => {
    const order = {
      number: 'ZAK-2026-00002',
      date: '2026-09-24',
      taken_by_name: 'Sardor',
      client_name: 'Baraka',
      payment_intent: 'OTKAZMA',
      items: [],
      total_amount: '0',
    } as unknown as Order;

    expect(orderToReceipt(order).paymentLabel).toBe("O'tkazma");
  });

  it('qadoqli tovar miqdorini qop/quti yorlig‘i bilan chiqaradi', () => {
    const order = {
      number: 'ZAK-2026-00003',
      created_at: '2026-11-16T09:00:00Z',
      taken_by_name: 'Sardor',
      client_name: 'Baraka',
      payment_intent: 'NAQD',
      items: [
        {
          id: 'i1',
          product: 'p1',
          product_name: 'Poroshok 900gr',
          product_sku: 'P-900',
          quantity: '24.000',
          delivered_quantity: '0',
          price: '12600.00',
          amount: '302400.00',
          pack_quantity: '12.000',
          package_type: 'qop',
          unit_name: 'dona',
        },
      ],
      total_amount: '302400.00',
    } as unknown as Order;

    const receipt = orderToReceipt(order);
    expect(receipt.lines[0]).toEqual({
      name: 'Poroshok 900gr',
      qty: 24,
      qtyLabel: '2 qop',
      price: 12600,
    });

    const blob = buildReceiptPdf(receipt, null);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
