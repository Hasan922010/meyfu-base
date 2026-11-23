import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import type { Order } from '@/shared/api/orders';
import { dateShort, formatOrderQty } from '@/shared/lib/format';
import { paymentLabel } from '@/shared/lib/labels';

/** Buyurtmadan chek hujjati (PDF/ulashish uchun). */
export function orderToReceipt(o: Order): ReceiptDoc {
  return {
    kind: 'order',
    numberOrRef: o.number,
    synced: true,
    date: dateShort(o.created_at || o.date || ''),
    distributorName: o.taken_by_name || '',
    clientName: o.client_name || '',
    paymentLabel: o.payment_intent ? paymentLabel(o.payment_intent) : undefined,
    lines: (o.items ?? []).map((it) => {
      const qty = Math.round(Number(it.quantity) || 0);
      const qtyLabel = qty > 0 ? formatOrderQty(qty, it) : undefined;
      return {
        name: it.product_name || '',
        qty,
        price: Number(it.price) || 0,
        ...(qtyLabel ? { qtyLabel } : {}),
      };
    }),
    total: Number(o.total_amount) || 0,
  };
}
