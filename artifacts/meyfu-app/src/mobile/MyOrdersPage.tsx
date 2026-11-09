import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Banknote, CalendarClock, CircleCheckBig, CreditCard } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { fulfillOrderLocal } from '@/offline/actions';
import { db, type CachedOrder } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { usePrefetchedCoords } from '@/mobile/geo';
import { ReceiptButtons } from '@/mobile/ReceiptButtons';
import { orderToReceipt } from '@/mobile/lib/orderReceipt';
import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import { ordersApi } from '@/shared/api/orders';
import { DataState } from '@/shared/components/DataState';
import { useAuthStore } from '@/shared/store/authStore';
import { dateTimeShort, money } from '@/shared/lib/format';
import { businessDateISO } from '@/shared/lib/businessDay';
import { paymentLabel } from '@/shared/lib/labels';

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
  return businessDateISO(days);
}

export function MyOrdersPage(): ReactElement {
  // Zakaz oluvchi yetkazmaydi — faqat o'zi olgan buyurtmalar
  const isOrderTaker = useAuthStore((s) => s.user?.role) === 'ORDER_TAKER';
  const [tab, setTab] = useState<Tab>(isOrderTaker ? 'taken' : 'deliver');
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

      {!isOrderTaker && (
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
      )}

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
  // Yetkazish oynasi ochilganda GPS boshlanadi — saqlash uni 8 s kutmaydi (UX N4)
  const coordsForSave = usePrefetchedCoords(true);
  const [done, setDone] = useState<boolean>(false);

  const total = order.items.reduce(
    (s, it) => s + Number(qtys[it.id] || 0) * Number(it.price),
    0,
  );

  async function save(paymentType: PayType): Promise<void> {
    setSaving(true);
    try {
      const coords = await coordsForSave();
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
        date: dateTimeShort(new Date()),
        distributorName,
        clientName: order.client_name,
        paymentLabel: paymentLabel(paymentType),
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
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        onClick={onDone}
      >
        <ArrowLeft size={18} aria-hidden /> Orqaga
      </button>

      <div className="card-minimal flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Yetkazish</h1>
          <p className="text-xs text-gray-500">
            {order.client_name} · #{order.number}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 block">Jami buyurtma</span>
          <span className="font-bold text-brand">{money(order.total_amount)}</span>
        </div>
      </div>

      <ul className="space-y-2">
        {order.items.map((it) => {
          const remainingNeed = Math.max(0, Number(it.quantity) - Number(it.delivered_quantity));
          const currentDelivered = Number(qtys[it.id] || 0);
          return (
            <li key={it.id} className="card-minimal space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{it.product_name}</span>
                <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-500 font-medium">
                  buyurtma: {it.quantity} ta
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn min-h-[44px] min-w-[44px] p-0 text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl active:scale-95 transition"
                    onClick={() => setQtys((p) => ({ ...p, [it.id]: String(Math.max(0, currentDelivered - 1)) }))}
                    aria-label={`${it.product_name} — kamaytirish`}
                  >
                    -1
                  </button>
                  <input
                    className="field min-h-[44px] w-20 text-center font-bold text-base"
                    type="number"
                    inputMode="decimal"
                    aria-label={`${it.product_name} yetkazilgan miqdor`}
                    value={qtys[it.id] ?? ''}
                    onChange={(e) =>
                      setQtys((p) => ({ ...p, [it.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn min-h-[44px] min-w-[44px] p-0 text-sm font-bold bg-brand/10 text-brand rounded-xl active:scale-95 transition"
                    onClick={() => setQtys((p) => ({ ...p, [it.id]: String(currentDelivered + 1) }))}
                    aria-label={`${it.product_name} — ko'paytirish`}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn min-h-[44px] px-2.5 text-xs font-semibold text-brand hover:underline"
                    onClick={() => setQtys((p) => ({ ...p, [it.id]: String(remainingNeed) }))}
                  >
                    Hammasi ({remainingNeed})
                  </button>
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                  {money(Number(qtys[it.id] || 0) * Number(it.price))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="card-minimal flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">Topshiriladigan jami</span>
        <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{money(total)}</span>
      </div>

      <div className="grid gap-2.5 pt-1">
        <button
          className="btn min-h-[50px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-sm active:scale-[0.98] transition"
          disabled={saving || total <= 0}
          onClick={() => void save('NAQD')}
        >
          <Banknote size={20} aria-hidden /> Naqd pul · {money(total)}
        </button>
        <button
          className="btn min-h-[50px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-sm active:scale-[0.98] transition"
          disabled={saving || total <= 0}
          onClick={() => void save('PLASTIK')}
        >
          <CreditCard size={20} aria-hidden /> Plastik karta
        </button>
        <div className="card-minimal space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Qarz to'lov muddati</span>
            <div className="flex gap-1.5">
              {[
                { days: 7, label: '+7 kun' },
                { days: 14, label: '+14 kun' },
                { days: 30, label: '+30 kun' },
              ].map((chip) => (
                <button
                  key={chip.days}
                  type="button"
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg border transition ${
                    due === plusDays(chip.days)
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                  }`}
                  onClick={() => setDue(plusDays(chip.days))}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <input
            className="field"
            type="date"
            aria-label="Qarz muddati"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button
            className="btn min-h-[48px] flex w-full items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm active:scale-[0.98] transition"
            disabled={saving || total <= 0}
            onClick={() => void save('QARZ')}
          >
            <CalendarClock size={20} aria-hidden /> Qarzga topshirish
          </button>
        </div>
      </div>
    </div>
  );
}
