import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  CreditCard,
  Minus,
  Plus,
  Split,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveSaleLocal, type LocalSaleLine } from '@/offline/actions';
import { db } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { getCurrentCoords } from '@/mobile/geo';
import { ReceiptButtons } from '@/mobile/ReceiptButtons';
import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import { AmountInput } from '@/shared/components/AmountInput';
import { useAuthStore } from '@/shared/store/authStore';
import { money } from '@/shared/lib/format';

const PAY_LABEL: Record<string, string> = {
  NAQD: 'Naqd',
  PLASTIK: 'Plastik',
  QARZ: 'Qarzga',
  ARALASH: 'Aralash',
};

type Step = 'client' | 'items' | 'pay' | 'done';
type PayType = 'NAQD' | 'PLASTIK' | 'QARZ' | 'ARALASH';
type PayMode = 'choose' | 'QARZ' | 'ARALASH';

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface CartLine extends LocalSaleLine {
  max: number;
}

const QUICK = [1, 3, 5, 10, 12, 20];

export function NewSalePage(): ReactElement {
  const navigate = useNavigate();
  const { online, pending } = useSync();
  const distributorName = useAuthStore((s) => s.user?.full_name ?? '');
  const [step, setStep] = useState<Step>('client');
  const [receipt, setReceipt] = useState<ReceiptDoc | null>(null);

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], []);
  const van = useLiveQuery(() => db.van_stock.toArray(), [], []);

  const [clientId, setClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [picked, setPicked] = useState<string>('');
  const [pickedPrice, setPickedPrice] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [payMode, setPayMode] = useState<PayMode>('choose');
  const [dueDate, setDueDate] = useState<string>(plusDays(14));
  const [cashPart, setCashPart] = useState<string>('');

  const client = clients.find((c) => c.id === clientId);
  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.price, 0),
    [cart],
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const availableProducts = van.filter(
    (v) =>
      v.quantity > 0 &&
      v.product_name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const thumbById = useMemo(
    () => new Map(products.map((p) => [p.id, p.image_thumb])),
    [products],
  );

  function suggestedPrice(productId: string): string {
    const p = products.find((x) => x.id === productId);
    return p?.wholesale_price ?? '';
  }

  function addToCart(): void {
    const vs = van.find((v) => v.product === picked);
    const price = Number(pickedPrice || suggestedPrice(picked));
    if (!vs || qty <= 0 || price <= 0) return;
    setCart((prev) => {
      const rest = prev.filter((l) => l.product !== picked);
      return [
        ...rest,
        {
          product: vs.product,
          product_name: vs.product_name,
          quantity: Math.min(vs.quantity, qty),
          price,
          max: vs.quantity,
        },
      ];
    });
    setPicked('');
    setPickedPrice('');
    setQty(1);
    setProductSearch('');
  }

  async function save(
    paymentType: PayType,
    opts?: { paidAmount?: number; dueDate?: string },
  ): Promise<void> {
    if (!client || cart.length === 0) return;
    setSaving(true);
    try {
      const coords = await getCurrentCoords();
      const needsDue = paymentType === 'QARZ' || paymentType === 'ARALASH';
      const due = needsDue ? (opts?.dueDate ?? dueDate) : null;
      const uuid = await saveSaleLocal({
        client: client.id,
        client_name: client.name,
        payment_type: paymentType,
        ...(opts?.paidAmount != null ? { paid_amount: opts.paidAmount } : {}),
        due_date: due,
        lines: cart.map((l) => ({
          product: l.product,
          product_name: l.product_name,
          quantity: l.quantity,
          price: l.price,
        })),
        ...(coords ?? {}),
      });
      const paid =
        paymentType === 'QARZ'
          ? 0
          : paymentType === 'ARALASH'
            ? (opts?.paidAmount ?? 0)
            : total;
      setReceipt({
        kind: 'sale',
        numberOrRef: uuid.slice(0, 8).toUpperCase(),
        synced: false,
        date: new Date().toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        distributorName,
        clientName: client.name,
        paymentLabel: PAY_LABEL[paymentType],
        lines: cart.map((l) => ({
          name: l.product_name,
          qty: l.quantity,
          price: l.price,
        })),
        total,
        paid,
        debt: Math.max(0, total - paid),
        dueDate: due,
      });
      setStep('done');
    } finally {
      setSaving(false);
    }
  }

  function reset(): void {
    setPayMode('choose');
    setCashPart('');
    setStep('client');
    setClientId('');
    setCart([]);
    setClientSearch('');
    setReceipt(null);
  }

  // ---- DONE ----
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Saqlandi</h1>
        <p className="text-gray-500">
          {client?.name} · {money(total)}
        </p>
        <p className="text-sm text-gray-400">
          {!online
            ? "Internet yo'q — saqlandi, ulanish paydo bo'lganda yuboriladi."
            : pending > 0
              ? 'Serverga yuborilmoqda…'
              : 'Serverga yuborildi.'}
        </p>

        {receipt && (
          <div className="w-full max-w-xs pt-2">
            <ReceiptButtons
              getDoc={() => receipt}
              filename={`chek-${receipt.numberOrRef}.pdf`}
            />
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button className="btn px-5" onClick={() => navigate('/m')}>
            Bosh sahifa
          </button>
          <button className="btn-brand px-5" onClick={reset}>
            Yangi sotuv
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Yangi sotuv</h1>

      {/* STEP: client */}
      {step === 'client' && (
        <div className="space-y-2">
          <input
            className="field"
            placeholder="Mijoz qidirish…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          <ul className="space-y-1">
            {filteredClients.slice(0, 30).map((c) => (
              <li key={c.id}>
                <button
                  className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-left shadow-sm dark:bg-gray-900"
                  onClick={() => {
                    setClientId(c.id);
                    setStep('items');
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.is_blocked && (
                    <span className="text-xs text-danger">Bloklangan</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP: items */}
      {step === 'items' && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">Mijoz: {client?.name}</div>

          <input
            className="field"
            placeholder="Tovar qidirish…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productSearch && !picked && (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {availableProducts.slice(0, 20).map((p) => (
                <li key={p.product}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg bg-white p-2 text-left text-sm shadow-sm dark:bg-gray-900"
                    onClick={() => setPicked(p.product)}
                  >
                    {thumbById.get(p.product) ? (
                      <img
                        src={thumbById.get(p.product) ?? ''}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
                    )}
                    <span className="flex-1">{p.product_name}</span>
                    <span className="text-gray-400">
                      {p.quantity} {p.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (
            <div className="space-y-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
              <div className="font-medium">
                {van.find((v) => v.product === picked)?.product_name}
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Kamaytirish"
                >
                  <Minus size={22} aria-hidden />
                </button>
                <span className="w-16 text-center text-2xl font-bold">{qty}</span>
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                  onClick={() => setQty((q) => q + 1)}
                  aria-label="Ko'paytirish"
                >
                  <Plus size={22} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK.map((n) => (
                  <button
                    key={n}
                    className="min-w-[44px] rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800"
                    onClick={() => setQty(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                className="field"
                type="number"
                inputMode="decimal"
                placeholder={`Narx (taxminan ${suggestedPrice(picked)})`}
                value={pickedPrice}
                onChange={(e) => setPickedPrice(e.target.value)}
              />
              <button
                className="btn-brand w-full"
                disabled={Number(pickedPrice || suggestedPrice(picked)) <= 0}
                onClick={addToCart}
              >
                Savatga qo'shish
              </button>
            </div>
          )}

          {cart.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl bg-white text-sm shadow-sm dark:divide-gray-800 dark:bg-gray-900">
              {cart.map((l) => (
                <li key={l.product} className="flex justify-between p-3">
                  <span>
                    {l.product_name} · {l.quantity} × {money(l.price)}
                  </span>
                  <button
                    className="text-danger"
                    onClick={() =>
                      setCart((prev) => prev.filter((x) => x.product !== l.product))
                    }
                    aria-label="O'chirish"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Jami</span>
            <span className="text-lg font-bold">{money(total)}</span>
          </div>

          <button
            className="btn-brand w-full"
            disabled={cart.length === 0 || cart.some((l) => l.price <= 0)}
            onClick={() => setStep('pay')}
          >
            To'lovga o'tish
          </button>
        </div>
      )}

      {/* STEP: pay */}
      {step === 'pay' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 text-center shadow-sm dark:bg-gray-900">
            <div className="text-sm text-gray-500">{client?.name}</div>
            <div className="text-3xl font-bold">{money(total)}</div>
          </div>

          {payMode === 'choose' && (
            <>
              <div className="grid gap-3">
                <button
                  className="btn flex items-center justify-center gap-2 bg-success text-white"
                  disabled={saving}
                  onClick={() => void save('NAQD')}
                >
                  <Banknote size={18} aria-hidden /> Naqd
                </button>
                <button
                  className="btn flex items-center justify-center gap-2 bg-brand text-brand-fg"
                  disabled={saving}
                  onClick={() => void save('PLASTIK')}
                >
                  <CreditCard size={18} aria-hidden /> Plastik
                </button>
                <button
                  className="btn flex items-center justify-center gap-2 bg-pending text-white"
                  disabled={saving || client?.is_blocked}
                  onClick={() => setPayMode('QARZ')}
                >
                  <CalendarClock size={18} aria-hidden />
                  {client?.is_blocked ? 'Qarz (bloklangan)' : 'Qarzga'}
                </button>
                <button
                  className="btn flex items-center justify-center gap-2"
                  disabled={saving || client?.is_blocked}
                  onClick={() => setPayMode('ARALASH')}
                >
                  <Split size={18} aria-hidden /> Aralash (bir qism naqd)
                </button>
              </div>
              <button
                className="btn flex w-full items-center justify-center gap-1.5"
                onClick={() => setStep('items')}
              >
                <ArrowLeft size={16} aria-hidden /> Orqaga
              </button>
            </>
          )}

          {(payMode === 'QARZ' || payMode === 'ARALASH') && (
            <div className="space-y-3">
              {payMode === 'ARALASH' && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Naqd to'lanadi</span>
                  <AmountInput
                    className="text-lg"
                    value={cashPart}
                    onChange={setCashPart}
                  />
                  <span className="text-xs text-gray-500">
                    Qarzga qoladi: {money(Math.max(0, total - Number(cashPart || 0)))}
                  </span>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-sm font-medium">Qarz muddati</span>
                <input
                  className="field"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <button
                className="btn-brand w-full"
                disabled={
                  saving ||
                  (payMode === 'ARALASH' &&
                    (Number(cashPart) <= 0 || Number(cashPart) >= total))
                }
                onClick={() =>
                  void save(payMode, {
                    dueDate,
                    ...(payMode === 'ARALASH'
                      ? { paidAmount: Number(cashPart) }
                      : {}),
                  })
                }
              >
                Tasdiqlash
              </button>
              <button
                className="btn flex w-full items-center justify-center gap-1.5"
                onClick={() => setPayMode('choose')}
              >
                <ArrowLeft size={16} aria-hidden /> Orqaga
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
