import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CircleCheckBig,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { saveOrderLocal, type LocalOrderLine } from '@/offline/actions';
import { db } from '@/offline/db';
import { useSync } from '@/offline/useSync';
import { PriceFormulaCard } from '@/shared/components/PriceFormulaCard';
import { QuantityStepper } from '@/shared/components/QuantityStepper';
import { UnitToggle } from '@/shared/components/UnitToggle';
import { money } from '@/shared/lib/format';
import { businessDateISO } from '@/shared/lib/businessDay';
import { paymentLabel } from '@/shared/lib/labels';

type Step = 'client' | 'items' | 'meta' | 'done';
type Intent = '' | 'NAQD' | 'PLASTIK' | 'OTKAZMA' | 'QARZ' | 'ARALASH';

const INTENTS: Array<{ v: Intent; l: string }> = [
  { v: '', l: 'Aniqlanmagan' },
  ...(['NAQD', 'PLASTIK', 'OTKAZMA', 'QARZ', 'ARALASH'] as const).map((v) => ({
    v,
    l: paymentLabel(v),
  })),
];

function plusDays(days: number): string {
  return businessDateISO(days);
}

export function NewOrderPage(): ReactElement {
  const navigate = useNavigate();
  const { online, pending } = useSync();
  const [step, setStep] = useState<Step>('client');

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], []);
  const products = useLiveQuery(() => db.products.toArray(), [], []);

  const [searchParams] = useSearchParams();
  const [clientId, setClientId] = useState<string>(searchParams.get('client') ?? '');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [cart, setCart] = useState<LocalOrderLine[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [unitMode, setUnitMode] = useState<'base' | 'package'>('base');
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

  const filteredClients = useMemo(
    () =>
      clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()),
      ),
    [clients, clientSearch],
  );
  const productQ = productSearch.trim().toLowerCase().replace(/[‘'’`]/g, "'");
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (!productQ) return true;
      const name = (p.name || '').toLowerCase().replace(/[‘'’`]/g, "'");
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(productQ) || sku.includes(productQ) || barcode.includes(productQ);
    });
  }, [products, productQ]);

  function suggestedPrice(productId: string): string {
    const p = products.find((x) => x.id === productId);
    return p?.wholesale_price || p?.cost_price || '';
  }

  function addToCart(): void {
    const p = products.find((x) => x.id === picked);
    const price = Number(pickedPrice || suggestedPrice(picked));
    if (!p || qty <= 0 || price <= 0) return;
    const pPackQty = Number(p.pack_quantity) || 1;
    const pPackType = p.package_type?.trim() || '';
    const isPack = unitMode === 'package';
    const totalQty = isPack ? qty * pPackQty : qty;

    setCart((prev) => [
      ...prev.filter((l) => l.product !== picked),
      {
        product: p.id,
        product_name: p.name,
        quantity: totalQty,
        price,
        unit_mode: isPack ? 'package' : 'base',
        package_count: isPack ? qty : undefined,
        package_type: isPack ? (pPackType || 'qadoq') : undefined,
        pack_quantity: pPackQty,
        unit_name: p.unit || 'dona',
      },
    ]);
    setPicked('');
    setPickedPrice('');
    setQty(1);
    setUnitMode('base');
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
          <button className="btn px-5" onClick={() => void navigate('/m/orders')}>
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
            aria-label="Mijoz qidirish"
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
            aria-label="Tovar qidirish"
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
                    onClick={() => {
                      setPicked(p.id);
                      const pPackQty = Number(p.pack_quantity) || 1;
                      const pPackType = p.package_type?.trim() || '';
                      setUnitMode(pPackQty > 1 || pPackType ? 'package' : 'base');
                      setQty(1);
                      setPickedPrice(suggestedPrice(p.id));
                    }}
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
                    <span className="text-gray-400">
                      {money(p.wholesale_price || p.cost_price || 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (() => {
            const p = products.find((x) => x.id === picked);
            if (!p) return null;
            const packQty = Number(p.pack_quantity) || 1;
            const packType = p.package_type?.trim() || '';
            const hasPackaging = packQty > 1 || Boolean(packType);
            const baseUnit = p.unit || 'dona';
            const packLabel = packType || 'qadoq';

            const isPack = unitMode === 'package';
            const totalBaseQty = isPack ? qty * packQty : qty;
            const unitPrice = Number(pickedPrice || suggestedPrice(picked));
            const lineTotal = totalBaseQty * unitPrice;

            return (
              <div className="card-minimal space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-white">
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Asosiy birlik: <span className="font-medium">{baseUnit}</span>
                      {hasPackaging && (
                        <span> · Qadoq: 1 {packLabel} = {packQty} {baseUnit}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    onClick={() => {
                      setPicked('');
                      setPickedPrice('');
                      setQty(1);
                      setUnitMode('base');
                    }}
                    aria-label="Bekor qilish"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                {hasPackaging && (
                  <UnitToggle
                    mode={unitMode}
                    baseUnit={baseUnit}
                    packageType={packType}
                    packQuantity={packQty}
                    onChange={setUnitMode}
                  />
                )}

                <QuantityStepper
                  value={qty}
                  unitLabel={isPack ? packLabel : baseUnit}
                  onChange={setQty}
                />

                <PriceFormulaCard
                  isPackage={isPack}
                  packageCount={qty}
                  packageType={packType}
                  packQuantity={packQty}
                  baseUnit={baseUnit}
                  totalBaseQty={totalBaseQty}
                  unitPrice={unitPrice}
                  totalPrice={lineTotal}
                />

                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  aria-label="Tovar narxi"
                  placeholder={`Narx (${baseUnit} uchun taxminan ${suggestedPrice(picked)})`}
                  value={pickedPrice}
                  onChange={(e) => setPickedPrice(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-brand w-full shadow-md shadow-brand/20"
                  disabled={unitPrice <= 0}
                  onClick={addToCart}
                >
                  Savatga qo'shish ({money(lineTotal)})
                </button>
              </div>
            );
          })()}

          {cart.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl bg-white text-sm shadow-sm dark:divide-gray-800 dark:bg-gray-900">
              {cart.map((l) => (
                <li key={l.product} className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="truncate font-medium">{l.product_name}</div>
                    <div className="text-xs text-gray-500">
                      {l.unit_mode === 'package' && l.package_count ? (
                        <>
                          <span className="font-semibold text-brand">
                            {l.package_count} {l.package_type || 'qadoq'}
                          </span>{' '}
                          ({l.quantity} {l.unit_name || 'dona'}) × {money(l.price)} ={' '}
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {money(l.quantity * l.price)}
                          </span>
                        </>
                      ) : (
                        <>
                          {l.quantity} {l.unit_name || 'dona'} × {money(l.price)} ={' '}
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {money(l.quantity * l.price)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="rounded p-1 text-danger hover:bg-danger/10"
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
