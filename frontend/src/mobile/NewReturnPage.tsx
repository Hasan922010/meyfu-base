import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheckBig, Minus, Plus } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveSaleReturnLocal, type ReturnReason } from '@/offline/actions';
import { db } from '@/offline/db';
import { money } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';

const REASONS: Array<{ v: ReturnReason; label: string }> = [
  { v: 'BRAK', label: 'Brak' },
  { v: 'MUDDAT', label: "Muddati o'tgan" },
  { v: 'KELISHMOVCHILIK', label: 'Kelishmovchilik' },
];

/** B3: mijozdan tovar qaytarish — offline, 4 qadam: mijoz → tovar → sabab → saqlash. */
export function NewReturnPage(): ReactElement {
  const navigate = useNavigate();
  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], []);
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [], []);

  const toast = useToast();
  const [clientId, setClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>('BRAK');
  const [restock, setRestock] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);

  const client = clients.find((c) => c.id === clientId);
  const lines = useMemo(
    () =>
      products
        .filter((p) => (qty[p.id] ?? 0) > 0)
        .map((p) => ({
          product: p.id,
          product_name: p.name,
          quantity: qty[p.id] ?? 0,
          price: Number(p.wholesale_price) || 0,
        })),
    [products, qty],
  );
  const total = lines.reduce((s, l) => s + l.quantity * l.price, 0);

  function change(productId: string, delta: number): void {
    setQty((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) }));
  }

  async function save(): Promise<void> {
    if (!client || lines.length === 0) return;
    setSaving(true);
    try {
      await saveSaleReturnLocal({
        client: client.id,
        client_name: client.name,
        reason,
        restock,
        lines,
        note,
      });
      setDone(true);
    } catch (err) {
      // IndexedDB xatosi (kvota, private rejim) — jim o'tmasin (audit FE-115)
      console.error('[NewReturnPage] lokal saqlash', err);
      toast.push({ kind: 'danger', title: 'Telefonda saqlab bo‘lmadi — xotira to‘lgan bo‘lishi mumkin. Qayta urinib ko‘ring.' });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Qaytarish saqlandi</h1>
        <p className="text-gray-500">
          {money(total)} · {client?.name}
          <br />
          Internet bo‘lganda serverga yuboriladi.
        </p>
        <div className="flex gap-2 pt-2">
          <button className="btn px-5" onClick={() => void navigate('/m')}>
            Bosh sahifa
          </button>
          <button
            className="btn-brand px-5"
            onClick={() => {
              setDone(false);
              setQty({});
              setNote('');
            }}
          >
            Yana
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    const filtered = clients.filter((c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()),
    );
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Tovar qaytarish</h1>
        <input
          className="field"
          placeholder="Mijozni qidirish"
          aria-label="Mijozni qidirish"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
        />
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                className="w-full rounded-xl bg-white p-3 text-left shadow-sm dark:bg-gray-900"
                onClick={() => setClientId(c.id)}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.address}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-gray-500">
              Mijoz topilmadi. Katalogni yangilab ko‘ring (Profil → Katalogni yangilash).
            </li>
          )}
        </ul>
      </div>
    );
  }

  const shown = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Qaytarish</h1>
        <button className="text-sm text-brand" onClick={() => setClientId('')}>
          {client.name} ›
        </button>
      </div>

      <div className="flex gap-2">
        {REASONS.map((r) => (
          <button
            key={r.v}
            onClick={() => setReason(r.v)}
            className={`flex-1 rounded-lg py-2 text-xs ${
              reason === r.v ? 'bg-brand text-brand-fg' : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        Tovar mashinaga qaytadi (sotish mumkin)
      </label>

      <input
        className="field"
        placeholder="Tovarni qidirish"
        aria-label="Tovarni qidirish"
        value={productSearch}
        onChange={(e) => setProductSearch(e.target.value)}
      />

      <ul className="space-y-2">
        {shown.map((p) => {
          const q = qty[p.id] ?? 0;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">{money(Number(p.wholesale_price))}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800"
                  aria-label={`${p.name} kamaytirish`}
                  disabled={q === 0}
                  onClick={() => change(p.id, -1)}
                >
                  <Minus size={16} aria-hidden />
                </button>
                <span className="w-8 text-center font-semibold">{q}</span>
                <button
                  className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800"
                  aria-label={`${p.name} ko'paytirish`}
                  onClick={() => change(p.id, 1)}
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <input
        className="field"
        aria-label="Izoh"
        placeholder="Izoh (ixtiyoriy)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="sticky bottom-20 rounded-xl bg-white p-3 shadow-md dark:bg-gray-900">
        <div className="mb-2 flex justify-between text-sm">
          <span>{lines.length} xil tovar</span>
          <span className="font-bold">{money(total)}</span>
        </div>
        <button
          className="btn-brand w-full"
          disabled={lines.length === 0 || saving}
          onClick={() => void save()}
        >
          Qaytarishni saqlash
        </button>
      </div>
    </div>
  );
}
