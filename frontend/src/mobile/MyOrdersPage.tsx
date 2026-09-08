import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Banknote, CalendarClock, CircleCheckBig, CreditCard } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { fulfillOrderLocal } from '@/offline/actions';
import { db, type CachedOrder } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { getCurrentCoords } from '@/mobile/geo';
import { ReceiptButtons } from '@/mobile/ReceiptButtons';
import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import { ordersApi, type Order } from '@/shared/api/orders';
import { DataState } from '@/shared/components/DataState';
import { useAuthStore } from '@/shared/store/authStore';
import { money } from '@/shared/lib/format';

const PAY_LABEL: Record<string, string> = {
  NAQD: 'Naqd',
  PLASTIK: 'Plastik',
  QARZ: 'Qarzga',
};

type Tab = 'taken' | 'deliver';
type PayType = 'NAQD' | 'PLASTIK' | 'QARZ';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-gray-400',
  PLACED: 'text-pending',
  APPROVED: 'text-brand',
  LOADED: 'text-brand',
  DELIVERED: 'text-success',
  PARTIALLY_DELIVERED: 'text-pending',
  CANCELLED: 'text-danger',
};

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MyOrdersPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('deliver');
  const [fulfilling, setFulfilling] = useState<CachedOrder | null>(null);

  if (fulfilling) {
    return (
      <FulfillScreen order={fulfilling} onDone={() => setFulfilling(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Buyurtmalar</h1>
        <Link to="/m/order/new" className="btn-brand px-3 py-1.5 text-sm">
          + Yangi
        </Link>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(
          [
            { id: 'deliver', l: 'Yetkazishim' },
            { id: 'taken', l: 'Olganlarim' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'deliver' ? (
        <DeliverTab onPick={setFulfilling} />
      ) : (
        <TakenTab />
      )}
    </div>
  );
}

function DeliverTab({
  onPick,
}: {
  onPick: (o: CachedOrder) => void;
}): ReactElement {
  const orders = useLiveQuery(() => db.orders.toArray(), [], []);
  const ready = orders.filter(
    (o) => o.status === 'APPROVED' || o.status === 'LOADED',
  );

  if (ready.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        Yetkaziladigan buyurtma yo'q.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {ready.map((o) => (
        <li key={o.id}>
          <button
            className="w-full space-y-1 rounded-xl bg-white p-3 text-left shadow-sm dark:bg-gray-900"
            onClick={() => onPick(o)}
          >
            <div className="flex justify-between">
              <span className="font-medium">{o.client_name}</span>
              <span className="text-sm font-semibold">{money(o.total_amount)}</span>
            </div>
            <div className="text-xs text-gray-500">
              {o.number} · {o.items.length} tovar · zakaz: {o.taken_by_name}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function orderToReceipt(o: Order): ReceiptDoc {
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
    paymentLabel: o.payment_intent ? PAY_LABEL[o.payment_intent] : undefined,
    lines: o.items.map((it) => ({
      name: it.product_name,
      qty: Number(it.quantity),
      price: Number(it.price),
    })),
    total: Number(o.total_amount),
  };
}

function TakenTab(): ReactElement {
  const q = useQuery({
    queryKey: ['orders', 'my-to-take'],
    queryFn: () => ordersApi.myToTake(),
  });
  const rows = q.data ?? [];

  return (
    <DataState
      isLoading={q.isLoading}
      isError={q.isError}
      isEmpty={!q.isLoading && rows.length === 0}
      emptyText="Siz olgan buyurtma yo'q"
    >
      <ul className="space-y-2">
        {rows.map((o) => (
          <li
            key={o.id}
            className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
          >
            <div className="flex justify-between">
              <span className="font-medium">{o.client_name}</span>
              <span className={`text-sm ${STATUS_CLASS[o.status] ?? ''}`}>
                {o.status_display}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{o.number}</span>
              <span>{money(o.total_amount)}</span>
            </div>
            <ReceiptButtons
              getDoc={() => orderToReceipt(o)}
              filename={`buyurtma-${o.number}.pdf`}
            />
          </li>
        ))}
      </ul>
    </DataState>
  );
}

function FulfillScreen({
  order,
  onDone,
}: {
  order: CachedOrder;
  onDone: () => void;
}): ReactElement {
  const { online, pending } = useSync();
  const distributorName = useAuthStore((s) => s.user?.full_name ?? '');
  const [receipt, setReceipt] = useState<ReceiptDoc | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(
      order.items.map((it) => [
        it.id,
        String(
          Math.max(0, Number(it.quantity) - Number(it.delivered_quantity)),
        ),
      ]),
    ),
  );
  const [due, setDue] = useState<string>(plusDays(14));
  const [saving, setSaving] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);

  const total = order.items.reduce(
    (s, it) => s + Number(qtys[it.id] || 0) * Number(it.price),
    0,
  );

  async function save(paymentType: PayType): Promise<void> {
    setSaving(true);
    try {
      const coords = await getCurrentCoords();
      const lines = order.items
        .map((it) => ({
          item: it.id,
          product: it.product,
          delivered_quantity: Number(qtys[it.id] || 0),
          price: Number(it.price),
        }))
        .filter((l) => l.delivered_quantity > 0);
      if (lines.length === 0) return;
      await fulfillOrderLocal({
        order: order.id,
        client_name: order.client_name,
        payment_type: paymentType,
        due_date: paymentType === 'QARZ' ? due : null,
        lines,
        ...(coords ?? {}),
      });
      const paid = paymentType === 'QARZ' ? 0 : total;
      setReceipt({
        kind: 'sale',
        numberOrRef: order.number,
        synced: false,
        date: new Date().toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        distributorName,
        clientName: order.client_name,
        paymentLabel: PAY_LABEL[paymentType],
        lines: lines.map((l) => {
          const it = order.items.find((x) => x.id === l.item);
          return {
            name: it?.product_name ?? '',
            qty: l.delivered_quantity,
            price: l.price,
          };
        }),
        total,
        paid,
        debt: Math.max(0, total - paid),
        dueDate: paymentType === 'QARZ' ? due : null,
      });
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Yetkazildi</h1>
        <p className="text-gray-500">
          {order.client_name} · {money(total)}
        </p>
        <p className="text-sm text-gray-400">
          {!online
            ? "Internet yo'q — saqlandi, keyin yuboriladi."
            : pending > 0
              ? 'Serverga yuborilmoqda…'
              : 'Serverga yuborildi.'}
        </p>
        {receipt && (
          <div className="w-full max-w-xs">
            <ReceiptButtons
              getDoc={() => receipt}
              filename={`chek-${receipt.numberOrRef}.pdf`}
            />
          </div>
        )}
        <button className="btn-brand px-6" onClick={onDone}>
          Ortga
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-1.5 text-sm text-gray-500"
        onClick={onDone}
      >
        <ArrowLeft size={16} aria-hidden /> Orqaga
      </button>

      <div>
        <h1 className="text-xl font-bold">Yetkazish</h1>
        <p className="text-sm text-gray-500">
          {order.client_name} · {order.number}
        </p>
      </div>

      <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm dark:divide-gray-800 dark:bg-gray-900">
        {order.items.map((it) => (
          <li key={it.id} className="space-y-1 p-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{it.product_name}</span>
              <span className="text-gray-400">
                buyurtma: {it.quantity}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Yetkazildi</span>
              <input
                className="field w-24"
                type="number"
                inputMode="decimal"
                value={qtys[it.id] ?? ''}
                onChange={(e) =>
                  setQtys((p) => ({ ...p, [it.id]: e.target.value }))
                }
              />
              <span className="text-sm text-gray-400">× {money(it.price)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Jami</span>
        <span className="text-lg font-bold">{money(total)}</span>
      </div>

      <div className="grid gap-2">
        <button
          className="btn flex items-center justify-center gap-2 bg-success text-white"
          disabled={saving || total <= 0}
          onClick={() => void save('NAQD')}
        >
          <Banknote size={18} aria-hidden /> Naqd
        </button>
        <button
          className="btn flex items-center justify-center gap-2 bg-brand text-brand-fg"
          disabled={saving || total <= 0}
          onClick={() => void save('PLASTIK')}
        >
          <CreditCard size={18} aria-hidden /> Plastik
        </button>
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <label className="mb-2 block space-y-1">
            <span className="text-xs text-gray-500">Qarz muddati</span>
            <input
              className="field"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <button
            className="btn flex w-full items-center justify-center gap-2 bg-pending text-white"
            disabled={saving || total <= 0}
            onClick={() => void save('QARZ')}
          >
            <CalendarClock size={18} aria-hidden /> Qarzga
          </button>
        </div>
      </div>
    </div>
  );
}
