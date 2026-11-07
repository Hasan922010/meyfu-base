import { describe, expect, it } from 'vitest';

import type { Order } from '@/shared/api/orders';

import { orderToReceipt } from './orderReceipt';

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
});
