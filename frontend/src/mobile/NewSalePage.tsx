import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  CreditCard,
  Split,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveSaleLocal } from '@/offline/actions';
import { db } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { usePrefetchedCoords } from '@/mobile/geo';
import type { CartLine } from '@/mobile/lib/cart';
import { ReceiptButtons } from '@/mobile/ReceiptButtons';
import { SaleProductList } from '@/mobile/SaleProductList';
import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import { AmountInput } from '@/shared/components/AmountInput';
import { useAuthStore } from '@/shared/store/authStore';
import { money } from '@/shared/lib/format';
import { businessDateISO } from '@/shared/lib/businessDay';

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
  return businessDateISO(days);
}

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
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [payMode, setPayMode] = useState<PayMode>('choose');
  const [dueDate, setDueDate] = useState<string>(plusDays(14));
  const [cashPart, setCashPart] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  // Mijoz tanlanganda GPS boshlanadi — saqlash uni uzoq kutmaydi (UX m3)
  const coordsForSave = usePrefetchedCoords(clientId !== '');

  const client = clients.find((c) => c.id === clientId);
  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.price, 0),
    [cart],
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const thumbById = useMemo(
    () => new Map(products.map((p) => [p.id, p.image_thumb])),
    [products],
  );

  function suggestedPrice(productId: string): string {
    const p = products.find((x) => x.id === productId);
    return p?.wholesale_price ?? '';
  }

  async function save(
    paymentType: PayType,
    opts?: { paidAmount?: number; dueDate?: string },
  ): Promise<void> {
    if (!client || cart.length === 0) return;
    setSaving(true);
    try {
      const coords = await coordsForSave();
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
    setNotice('');
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
          <button className="btn px-5" onClick={() => void navigate('/m')}>
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

      {/* STEP: items — UX M4: tovarlar darhol, qatorga bosish = +1, Naqd pastda */}
      {step === 'items' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Mijoz: <span className="font-medium text-gray-900 dark:text-gray-100">{client?.name}</span>
            </span>
            <button className="text-brand underline" onClick={() => setStep('client')}>
              Mijozni almashtirish
            </button>
          </div>

          <SaleProductList
            van={van}
            cart={cart}
            priceOf={(id) => Number(suggestedPrice(id) || 0)}
            thumbOf={(id) => thumbById.get(id)}
            onChange={(next, message) => {
              setCart(next);
              setNotice(message);
            }}
          />

          {/* Pastdagi panel ro'yxatning oxirini yopmasligi uchun joy */}
          <div className="h-32" aria-hidden />

          <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md space-y-2 border-t border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
            {notice && (
              <p role="status" className="rounded-lg bg-pending/10 px-3 py-1.5 text-sm text-pending">
                {notice}
              </p>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Jami ({itemCount} dona)</span>
              <span className="text-lg font-bold">{money(total)}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="btn flex flex-1 items-center justify-center gap-2 bg-success text-white"
                disabled={saving || cart.length === 0}
                onClick={() => void save('NAQD')}
              >
                <Banknote size={18} aria-hidden /> Naqd · {money(total)}
              </button>
              <button
                className="btn px-3"
                disabled={saving || cart.length === 0}
                onClick={() => setStep('pay')}
              >
                Boshqa to'lov
              </button>
            </div>
          </div>
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
