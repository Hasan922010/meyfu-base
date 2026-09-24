import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import type { Order } from '@/shared/api/orders';
import { paymentLabel } from '@/shared/lib/labels';

/** Buyurtmadan chek hujjati (PDF/ulashish uchun). */
export function orderToReceipt(o: Order): ReceiptDoc {
  return {
    kind: 'order',
    numberOrRef: o.number,
    synced: true,
    date: new Date(o.created_at).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    distributorName: o.taken_by_name,
    clientName: o.client_name,
    paymentLabel: o.payment_intent ? paymentLabel(o.payment_intent) : undefined,
    lines: o.items.map((it) => ({
      name: it.product_name,
      qty: Number(it.quantity),
      price: Number(it.price),
    })),
    total: Number(o.total_amount),
  };
}
