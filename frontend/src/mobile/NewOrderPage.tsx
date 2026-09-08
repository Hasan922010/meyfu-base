import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CircleCheckBig,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveOrderLocal, type LocalOrderLine } from '@/offline/actions';
import { db } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { money } from '@/shared/lib/format';

type Step = 'client' | 'items' | 'meta' | 'done';
type Intent = '' | 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';

const QUICK = [1, 3, 5, 10, 12, 20];
const INTENTS: Array<{ v: Intent; l: string }> = [
  { v: '', l: 'Aniqlanmagan' },
  { v: 'NAQD', l: 'Naqd' },
  { v: 'PLASTIK', l: 'Plastik' },
  { v: 'OTKAZMA', l: "O'tkazma" },
  { v: 'QARZ', l: 'Qarzga' },
  { v: 'ARALASH', l: 'Aralash' },
];

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NewOrderPage(): ReactElement {
  const navigate = useNavigate();
  const { online, pending } = useSync();
  const [step, setStep] = useState<Step>('client');

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], []);
  const products = useLiveQuery(() => db.products.toArray(), [], []);

  const [clientId, setClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [cart, setCart] = useState<LocalOrderLine[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [picked, setPicked] = useState<string>('');
  const [pickedPrice, setPickedPrice] = useState<string>('');
  const [intent, setIntent] = useState<Intent>('');
  const [desired, setDesired] = useState<string>(plusDays(1));
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const client = clients.find((c) => c.id === clientId);
  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.price, 0),
    [cart],
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const filteredProducts = products.filter(
    (p) =>
      p.is_active &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())),
  );

  function suggestedPrice(productId: string): string {
    return products.find((x) => x.id === productId)?.wholesale_price ?? '';
  }

  function addToCart(): void {
    const p = products.find((x) => x.id === picked);
    const price = Number(pickedPrice || suggestedPrice(picked));
    if (!p || qty <= 0 || price <= 0) return;
    setCart((prev) => [
      ...prev.filter((l) => l.product !== picked),
      { product: p.id, product_name: p.name, quantity: qty, price },
    ]);
    setPicked('');
    setPickedPrice('');
    setQty(1);
    setProductSearch('');
  }

  async function save(): Promise<void> {
    if (!client || cart.length === 0) return;
    setSaving(true);
    try {
      await saveOrderLocal({
        client: client.id,
        client_name: client.name,
        payment_intent: intent,
        desired_date: desired || null,
        note,
        lines: cart,
      });
      setStep('done');
    } finally {
      setSaving(false);
    }
  }

  function reset(): void {
    setStep('client');
    setClientId('');
    setClientSearch('');
    setCart([]);
    setIntent('');
    setNote('');
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Buyurtma saqlandi</h1>
        <p className="text-gray-500">
          {client?.name} · {money(total)}
        </p>
        <p className="text-sm text-gray-400">
          {!online
            ? "Internet yo'q — saqlandi, ulanish paydo bo'lganda yuboriladi."
            : pending > 0
              ? 'Serverga yuborilmoqda…'
              : 'Serverga yuborildi — tasdiqlash kutilmoqda.'}
        </p>
        <div className="flex gap-2 pt-4">
          <button className="btn px-5" onClick={() => navigate('/m/orders')}>
            Buyurtmalarim
          </button>
          <button className="btn-brand px-5" onClick={reset}>
            Yangi buyurtma
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Yangi buyurtma (zakaz)</h1>

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
                  className="w-full rounded-xl bg-white p-3 text-left font-medium shadow-sm dark:bg-gray-900"
                  onClick={() => {
                    setClientId(c.id);
                    setStep('items');
                  }}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              {filteredProducts.slice(0, 20).map((p) => (
                <li key={p.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg bg-white p-2 text-left text-sm shadow-sm dark:bg-gray-900"
                    onClick={() => setPicked(p.id)}
                  >
                    {p.image_thumb ? (
                      <img
                        src={p.image_thumb}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
                    )}
                    <span className="flex-1">{p.name}</span>
                    <span className="text-gray-400">{money(p.wholesale_price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (
            <div className="space-y-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
              <div className="font-medium">
                {products.find((p) => p.id === picked)?.name}
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
                Qo'shish
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

          <div className="flex gap-2">
            <button
              className="btn flex flex-1 items-center justify-center gap-1.5"
              onClick={() => setStep('client')}
            >
              <ArrowLeft size={16} aria-hidden /> Mijoz
            </button>
            <button
              className="btn-brand flex-1"
              disabled={cart.length === 0}
              onClick={() => setStep('meta')}
            >
              Davom etish
            </button>
          </div>
        </div>
      )}

      {step === 'meta' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-center shadow-sm dark:bg-gray-900">
            <div className="text-sm text-gray-500">{client?.name}</div>
            <div className="text-3xl font-bold">{money(total)}</div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">To'lov niyati</span>
            <select
              className="field"
              value={intent}
              onChange={(e) => setIntent(e.target.value as Intent)}
            >
              {INTENTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Istalgan yetkazish sanasi</span>
            <input
              className="field"
              type="date"
              value={desired}
              onChange={(e) => setDesired(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Izoh</span>
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ixtiyoriy"
            />
          </label>

          <div className="flex gap-2">
            <button
              className="btn flex flex-1 items-center justify-center gap-1.5"
              onClick={() => setStep('items')}
            >
              <ArrowLeft size={16} aria-hidden /> Orqaga
            </button>
            <button
              className="btn-brand flex-1"
              disabled={saving}
              onClick={() => void save()}
            >
              Buyurtmani saqlash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
