import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CircleCheckBig,
  CreditCard,
  RefreshCw,
  Search,
  Split,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { saveSaleLocal } from '@/offline/actions';
import { db } from '@/offline/db';
import { pullVanStock } from '@/offline/sync';
import { useSync } from '@/offline/useSync';
import { usePrefetchedCoords } from '@/mobile/geo';
import type { CartLine } from '@/mobile/lib/cart';
import { ReceiptButtons } from '@/mobile/ReceiptButtons';
import { SaleProductList } from '@/mobile/SaleProductList';
import type { ReceiptDoc } from '@/mobile/lib/receiptPdf';
import { clientsApi } from '@/shared/api/clients';
import { warehouseApi } from '@/shared/api/warehouse';
import { AmountInput } from '@/shared/components/AmountInput';
import { useAuthStore } from '@/shared/store/authStore';
import { dateTimeShort, money } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';
import { businessDateISO } from '@/shared/lib/businessDay';
import { paymentLabel } from '@/shared/lib/labels';

type Step = 'client' | 'items' | 'pay' | 'done';
type PayType = 'NAQD' | 'PLASTIK' | 'QARZ' | 'ARALASH';
type PayMode = 'choose' | 'QARZ' | 'ARALASH';

function plusDays(days: number): string {
  return businessDateISO(days);
}

export function NewSalePage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClientId = searchParams.get('client') ?? '';
  const { online, pending } = useSync();
  const distributorName = useAuthStore((s) => s.user?.full_name ?? '');
  const toast = useToast();
  const [step, setStep] = useState<Step>(initialClientId ? 'items' : 'client');
  const [receipt, setReceipt] = useState<ReceiptDoc | null>(null);

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], []);
  const van = useLiveQuery(() => db.van_stock.toArray(), [], []);

  const [clientId, setClientId] = useState<string>(initialClientId);
  const [clientSearch, setClientSearch] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [payMode, setPayMode] = useState<PayMode>('choose');
  const [dueDate, setDueDate] = useState<string>(plusDays(14));
  const [cashPart, setCashPart] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  // Mijoz tanlanganda GPS boshlanadi — saqlash uni uzoq kutmaydi (UX m3)
  const coordsForSave = usePrefetchedCoords(clientId !== '');

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const fetched = await clientsApi.detail(clientId);
      try {
        await db.clients.put({
          id: fetched.id,
          name: fetched.name,
          owner_name: fetched.owner_name,
          phone: fetched.phone,
          address: fetched.address,
          route: fetched.route,
          debt_limit: fetched.debt_limit,
          current_debt: fetched.current_debt,
          is_blocked: fetched.is_blocked,
        });
      } catch {
        // ignore
      }
      return fetched;
    },
    enabled: Boolean(clientId) && !clients.find((c) => c.id === clientId) && online,
  });

  const client = clients.find((c) => c.id === clientId) ?? clientQuery.data;

  // Sahifa ochilganda mashina qoldig'ini avtomatik yangilash
  useEffect(() => {
    if (online) {
      void pullVanStock().catch(() => undefined);
    }
  }, [online]);

  const [refreshingVan, setRefreshingVan] = useState(false);
  async function handleRefreshVan(): Promise<void> {
    setRefreshingVan(true);
    try {
      await pullVanStock();
      toast.push({ kind: 'success', title: 'Mashina qoldig‘i yangilandi' });
    } catch {
      toast.push({ kind: 'danger', title: 'Qoldiqni yangilab bo‘lmadi' });
    } finally {
      setRefreshingVan(false);
    }
  }

  // Tasdiqlanmagan yuklamalar (SENT) bormi?
  const loadingsQuery = useQuery({
    queryKey: ['loadings', 'my-today'],
    queryFn: () => warehouseApi.myTodayLoadings(),
    enabled: online,
  });
  const awaitingLoadings = (loadingsQuery.data ?? []).filter((l) => l.status === 'SENT');

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.price, 0),
    [cart],
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const thumbById = useMemo(
    () => new Map(products.map((p) => [p.id, p.image_thumb])),
    [products],
  );

  function suggestedPrice(productId: string): string {
    const p = productMap.get(productId);
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
        date: dateTimeShort(new Date()),
        distributorName,
        clientName: client.name,
        paymentLabel: paymentLabel(paymentType),
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
    } catch (err) {
      // IndexedDB xatosi (kvota, private rejim) — jim o'tmasin (audit FE-115)
      console.error('[NewSalePage] lokal saqlash', err);
      toast.push({ kind: 'danger', title: 'Telefonda saqlab bo‘lmadi — xotira to‘lgan bo‘lishi mumkin. Qayta urinib ko‘ring.' });
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
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              className="field pl-10"
              aria-label="Mijoz qidirish"
              placeholder="Mijoz qidirish (nomi, manzili)…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="space-y-2">
            {filteredClients.slice(0, 30).map((c) => (
              <li key={c.id}>
                <button
                  className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-white p-3.5 text-left shadow-sm border border-gray-100 hover:border-brand/40 active:scale-[0.99] transition dark:border-gray-800 dark:bg-gray-900"
                  onClick={() => {
                    setClientId(c.id);
                    setStep('items');
                  }}
                >
                  <div className="min-w-0 pr-2">
                    <span className="block font-semibold text-gray-900 dark:text-gray-100">{c.name}</span>
                    {c.address && (
                      <span className="block truncate text-xs text-gray-500">{c.address}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {Number(c.current_debt) > 0 && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        {money(c.current_debt)} qarz
                      </span>
                    )}
                    {c.is_blocked && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-danger dark:bg-red-950/40">
                        Bloklangan
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP: items — UX M4: tovarlar darhol, qatorga bosish = +1, Naqd pastda */}
      {step === 'items' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-brand/5 p-3 text-sm border border-brand/10 dark:bg-brand/10 dark:border-brand/20">
            <div className="min-w-0">
              <span className="text-xs text-gray-500 block">Tanlangan mijoz</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate block">
                {client?.name || (clientQuery.isLoading ? 'Mijoz yuklanmoqda…' : '—')}
              </span>
            </div>
            <button
              className="btn min-h-[36px] py-1 px-3 text-xs bg-white text-brand border border-brand/20 shadow-xs hover:bg-brand/5 dark:bg-gray-800"
              onClick={() => setStep('client')}
            >
              O'zgartirish
            </button>
          </div>

          {awaitingLoadings.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-800 dark:text-warning-200">
              <div className="font-semibold">⚠️ Tasdiqlanmagan yuklama mavjud!</div>
              <div className="mt-0.5 text-gray-600 dark:text-gray-300">
                Mashinaga tovar tushishi uchun ombor yuborgan yuklamani tasdiqlang.
              </div>
              <button
                type="button"
                onClick={() => void navigate('/m/loading')}
                className="btn-brand mt-2 inline-block px-3 py-1 text-xs"
              >
                Yuklamalarga o‘tish →
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500 font-medium">Mashinadagi tovarlar ({van.length})</span>
            <button
              type="button"
              onClick={() => void handleRefreshVan()}
              disabled={refreshingVan}
              className="flex items-center gap-1 text-xs text-brand hover:underline font-medium"
            >
              <RefreshCw size={13} className={refreshingVan ? 'animate-spin' : ''} />
              {refreshingVan ? 'Yangilanmoqda…' : 'Qoldiqni yangilash'}
            </button>
          </div>

          <SaleProductList
            van={van}
            cart={cart}
            priceOf={(id) => Number(suggestedPrice(id) || 0)}
            minPriceOf={(id) => Number(productMap.get(id)?.min_price ?? 0)}
            thumbOf={(id) => thumbById.get(id)}
            packInfoOf={(id) => {
              const p = productMap.get(id);
              return p ? { package_type: p.package_type, pack_quantity: p.pack_quantity } : undefined;
            }}
            onChange={(next, message) => {
              setCart(next);
              setNotice(message);
            }}
          />

          {/* Pastdagi panel ro'yxatning oxirini yopmasligi uchun joy */}
          <div className="h-32" aria-hidden />

          <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md space-y-2 border-t border-gray-200 bg-white/95 p-3.5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 shadow-lg">
            {notice && (
              <p role="status" className="rounded-xl bg-pending/10 px-3 py-1.5 text-xs text-pending font-medium">
                {notice}
              </p>
            )}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 block">Jami summa</span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{money(total)}</span>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {itemCount} dona tovar
              </span>
            </div>
            <div className="flex gap-2.5">
              <button
                className="btn min-h-[48px] flex flex-1 items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold active:scale-[0.98] shadow-sm transition"
                disabled={saving || cart.length === 0}
                onClick={() => void save('NAQD')}
              >
                <Banknote size={20} aria-hidden /> Naqd · {money(total)}
              </button>
              <button
                className="btn min-h-[48px] px-4 font-semibold border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 active:scale-[0.98] transition"
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
          <div className="card-minimal text-center py-6 space-y-1">
            <div className="text-sm font-medium text-gray-500">{client?.name}</div>
            <div className="text-3xl font-black text-gray-900 dark:text-gray-100">{money(total)}</div>
            <div className="text-xs text-gray-400 font-medium">{itemCount} dona tovar</div>
          </div>

          {payMode === 'choose' && (
            <>
              <div className="grid gap-3">
                <button
                  className="btn min-h-[52px] flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-2xl shadow-sm active:scale-[0.98] transition"
                  disabled={saving}
                  onClick={() => void save('NAQD')}
                >
                  <Banknote size={22} aria-hidden /> Naqd pul bilan to'lash
                </button>
                <button
                  className="btn min-h-[52px] flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl shadow-sm active:scale-[0.98] transition"
                  disabled={saving}
                  onClick={() => void save('PLASTIK')}
                >
                  <CreditCard size={22} aria-hidden /> Plastik karta / O'tkazma
                </button>
                <button
                  className="btn min-h-[52px] flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base rounded-2xl shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                  disabled={saving || client?.is_blocked}
                  onClick={() => setPayMode('QARZ')}
                >
                  <CalendarClock size={22} aria-hidden />
                  {client?.is_blocked ? 'Qarz (mijoz bloklangan)' : 'Qarzga berish'}
                </button>
                <button
                  className="btn min-h-[52px] flex items-center justify-center gap-3 border-2 border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-bold text-base rounded-2xl shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                  disabled={saving || client?.is_blocked}
                  onClick={() => setPayMode('ARALASH')}
                >
                  <Split size={22} aria-hidden /> Aralash (qisman naqd + qarz)
                </button>
              </div>
              <button
                className="btn min-h-[48px] flex w-full items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-medium"
                onClick={() => setStep('items')}
              >
                <ArrowLeft size={16} aria-hidden /> Orqaga
              </button>
            </>
          )}

          {(payMode === 'QARZ' || payMode === 'ARALASH') && (
            <div className="space-y-4">
              {payMode === 'ARALASH' && (
                <div className="card-minimal space-y-2">
                  <span className="text-sm font-semibold">Naqd to'lanadigan summa</span>
                  <AmountInput
                    className="text-lg font-bold"
                    value={cashPart}
                    onChange={setCashPart}
                  />
                  <div className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    Qarzga qoladigan qism:{' '}
                    <span className="font-bold text-amber-600">
                      {money(Math.max(0, total - Number(cashPart || 0)))}
                    </span>
                  </div>
                </div>
              )}
              <div className="card-minimal space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Qarz muddati</span>
                  <div className="flex gap-1.5">
                    {[
                      { days: 7, label: '+7 kun' },
                      { days: 14, label: '+14 kun' },
                      { days: 30, label: '+30 kun' },
                    ].map((chip) => (
                      <button
                        key={chip.days}
                        type="button"
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                          dueDate === plusDays(chip.days)
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                        }`}
                        onClick={() => setDueDate(plusDays(chip.days))}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  className="field"
                  type="date"
                  aria-label="Qarz to'lov muddati"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <button
                className="btn-brand min-h-[50px] w-full text-base font-bold shadow-sm"
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
                className="btn min-h-[48px] flex w-full items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-medium"
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
