import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Check, CircleCheckBig, ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { unsentCount } from '@/offline/outbox';
import { extractApiError } from '@/shared/api/client';
import { dayCloseApi } from '@/shared/api/reports';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';

type Step = 1 | 2 | 3 | 4;
type Condition = 'GOOD' | 'DAMAGED' | 'EXPIRED';

interface ReturnRow {
  product: string;
  product_name: string;
  unit: string;
  suggested: number;
  quantity: string;
  condition: Condition;
}

export function DayCloseWizard(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  const today = useQuery({
    queryKey: ['day-close', 'my-today'],
    queryFn: () => dayCloseApi.myToday(),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 50 }),
  });

  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [cashHanded, setCashHanded] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [initialised, setInitialised] = useState<boolean>(false);

  const data = today.data;

  // van_items dan qatorlarni tayyorlash (bir marta)
  useEffect(() => {
    if (!data || data.submitted || initialised || !data.van_items) return;
    setRows(
      data.van_items.map((v) => ({
        product: v.product,
        product_name: v.product_name,
        unit: v.unit,
        suggested: Number(v.quantity),
        // "42.000" ru-lokalda "42,000" (42 ming) bo'lib ko'rinardi — ortiqcha nollarsiz (UX M5)
        quantity: String(Number(v.quantity)),
        condition: 'GOOD',
      })),
    );
    // "906000.00" ru-lokalda "906000,00" ko'rinardi — butun so'm (UX m2)
    setCashHanded(data.cash_expected != null ? String(Number(data.cash_expected)) : '');
    setInitialised(true);
  }, [data, initialised]);

  const returnValue = useMemo(
    () =>
      rows.reduce(
        (s, r) =>
          s +
          Number(r.quantity || 0) *
            Number(data?.van_items?.find((v) => v.product === r.product)?.wholesale_price ?? 0),
        0,
      ),
    [rows, data],
  );

  const cashDiff = Number(cashHanded || 0) - Number(data?.cash_expected ?? 0);
  const unsent = useLiveQuery(() => unsentCount(), [], 0) ?? 0;

  const submit = useMutation({
    mutationFn: () =>
      dayCloseApi.submit({
        warehouse: warehouses.data?.results[0]?.id ?? '',
        cash_handed: cashHanded || '0',
        note: cashDiff !== 0 ? note.trim() : '',
        items: rows
          .filter((r) => Number(r.quantity) > 0)
          .map((r) => ({
            product: r.product,
            quantity: r.quantity,
            condition: r.condition,
          })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-close'] });
      void qc.invalidateQueries({ queryKey: ['van-stock', 'my'] });
      setStep(4);
    },
  });

  if (today.isLoading) {
    return <DataState isLoading isError={false}>{null}</DataState>;
  }

  if (data?.submitted) {
    const dc = data.day_close;
    return (
      <div className="space-y-4 text-center">
        <ClipboardCheck size={48} className="mx-auto text-brand" aria-hidden />
        <h1 className="text-xl font-bold">Kun yopilgan</h1>
        <p className="text-gray-500">
          Holat: {dc?.status_display}. Admin tasdig'i kutilmoqda bo'lishi mumkin.
        </p>
        {dc && (
          <div className="mx-auto max-w-xs space-y-1 text-left text-sm">
            <Line label="Sotildi" value={money(dc.sold_amount)} />
            <Line label="Topshirildi" value={money(dc.cash_handed_amount)} />
            <Line
              label="Kassa farqi"
              value={money(dc.cash_difference)}
              danger={Number(dc.cash_difference) < 0}
            />
          </div>
        )}
        <button className="btn-brand px-6" onClick={() => void navigate('/m')}>
          Bosh sahifa
        </button>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4 py-12 text-center">
        <CircleCheckBig size={56} className="mx-auto text-success" aria-hidden />
        <h1 className="text-xl font-bold">Kun yopildi</h1>
        <p className="text-gray-500">Admin tasdiqlashini kuting.</p>
        <button className="btn-brand px-6" onClick={() => void navigate('/m')}>
          Bosh sahifa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 3-Step Ergonomic Progress Indicator */}
      <div className="card-minimal p-3" role="tablist" aria-label="Kun yopish bosqichlari">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Tovar', desc: 'Mashina qoldig‘i' },
            { step: 2, label: 'Pul', desc: 'Kassa topshirish' },
            { step: 3, label: 'Tasdiq', desc: 'Yakuniy hisobot' },
          ].map((item, idx) => (
            <div key={item.step} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => {
                  if (item.step < step) setStep(item.step as Step);
                }}
                disabled={item.step > step}
                className={`flex items-center gap-2 text-left transition ${
                  step === item.step
                    ? 'text-brand font-bold'
                    : step > item.step
                      ? 'text-success font-medium cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
                aria-current={step === item.step ? 'step' : undefined}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    step === item.step
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : step > item.step
                        ? 'bg-success text-white'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                  }`}
                >
                  {step > item.step ? <Check size={14} /> : item.step}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="text-[10px] text-gray-400">{item.desc}</div>
                </div>
              </button>
              {idx < 2 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition ${
                    step > idx + 1 ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {unsent > 0 && (
        <div role="alert" className="rounded-xl bg-pending/10 px-3.5 py-2.5 text-sm text-pending border border-pending/20">
          {unsent} ta operatsiya hali serverga yuborilmagan. Kunni yopishdan oldin ular
          yuborilishi kerak.{' '}
          <Link to="/m/sync" className="font-semibold underline">
            Sinxronizatsiya
          </Link>
        </div>
      )}

      {/* STEP 1 — Tovar */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <p className="text-xs text-gray-500">
              Mashinadagi qolgan tovarni sanab, qaytariladigan miqdorni kiriting.
            </p>
            {rows.length > 0 && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="text-xs text-brand font-semibold hover:underline"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((r) => ({ ...r, quantity: String(r.suggested) })),
                    )
                  }
                >
                  Hammasi
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  className="text-xs text-gray-500 font-semibold hover:underline"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((r) => ({ ...r, quantity: '0' })),
                    )
                  }
                >
                  0 qoldirish
                </button>
              </div>
            )}
          </div>

          {rows.map((r, idx) => {
            const currentQty = Number(r.quantity || 0);
            return (
              <div
                key={r.product}
                className="card-minimal space-y-2.5"
              >
                <div className="flex justify-between items-start text-sm">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{r.product_name}</span>
                  <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-500 font-medium">
                    tizimda: {r.suggested} {r.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn min-h-[44px] min-w-[44px] p-0 text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl active:scale-95 transition"
                      onClick={() => {
                        const val = Math.max(0, currentQty - 1);
                        setRows((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, quantity: String(val) } : x)),
                        );
                      }}
                      aria-label={`${r.product_name} — kamaytirish`}
                    >
                      -1
                    </button>
                    <input
                      className="field min-h-[44px] w-20 text-center font-bold text-base"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${r.product_name} — qaytariladigan miqdor`}
                      value={r.quantity}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, quantity: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn min-h-[44px] min-w-[44px] p-0 text-sm font-bold bg-brand/10 text-brand rounded-xl active:scale-95 transition"
                      onClick={() => {
                        const val = currentQty + 1;
                        setRows((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, quantity: String(val) } : x)),
                        );
                      }}
                      aria-label={`${r.product_name} — ko'paytirish`}
                    >
                      +1
                    </button>
                  </div>
                  <select
                    className="field min-h-[44px] flex-1 text-sm font-medium"
                    aria-label={`${r.product_name} holati`}
                    value={r.condition}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, condition: e.target.value as Condition }
                            : x,
                        ),
                      )
                    }
                  >
                    <option value="GOOD">Yaroqli</option>
                    <option value="DAMAGED">Shikastlangan</option>
                    <option value="EXPIRED">Muddati o'tgan</option>
                  </select>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="card-minimal text-center py-8">
              <p className="text-gray-400">Mashinada tovar yo'q — qaytarish shart emas.</p>
            </div>
          )}
          <div className="card-minimal flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Qaytariladigan summa</span>
            <span className="font-extrabold text-base text-gray-900 dark:text-gray-100">{money(returnValue)}</span>
          </div>
          <button
            className="btn-brand min-h-[50px] flex w-full items-center justify-center gap-2 text-base font-bold shadow-sm active:scale-[0.98] transition"
            onClick={() => setStep(2)}
          >
            Keyingi: Pul <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      )}

      {/* STEP 2 — Pul */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card-minimal space-y-2 text-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100 pb-1 border-b border-gray-100 dark:border-gray-800">
              Bugungi tushumlar hisobi
            </div>
            <Line label="Naqd sotuv" value={money(data?.cash_sales_amount ?? '0')} />
            <Line label="Undirilgan qarz" value={money(data?.debt_collected_amount ?? '0')} />
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <Line label="Kutilgan naqd" value={money(data?.cash_expected ?? '0')} bold />
          </div>
          <p className="text-xs text-gray-500 px-1">
            Faqat bugungi naqd sotuv va undirilgan qarz. Hamyondagi umumiy balans oldingi
            kunlarni ham o'z ichiga oladi, shuning uchun farq qilishi mumkin.
          </p>
          <div className="card-minimal space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Topshirilayotgan naqd</span>
              <button
                type="button"
                className="text-xs text-brand font-semibold hover:underline"
                onClick={() => setCashHanded(data?.cash_expected != null ? String(Number(data.cash_expected)) : '')}
              >
                Kutilgan summani qo'yish
              </button>
            </div>
            <input
              className="field min-h-[48px] text-xl font-black text-center"
              type="number"
              inputMode="decimal"
              aria-label="Topshirilayotgan naqd"
              value={cashHanded}
              onChange={(e) => setCashHanded(e.target.value)}
            />
          </div>
          <div
            className={`rounded-2xl p-3.5 text-sm font-medium border ${
              cashDiff < 0
                ? 'bg-danger/10 text-danger border-danger/20'
                : cashDiff > 0
                  ? 'bg-pending/10 text-pending border-pending/20'
                  : 'bg-success/10 text-success border-success/20'
            }`}
          >
            {cashDiff === 0
              ? '✓ Kassa farqi yo\'q — hisob to‘g‘ri'
              : `Kassa farqi: ${money(cashDiff)}${cashDiff < 0 ? ' (kamomad)' : ' (ortiqcha)'}`}
          </div>
          {/* Farq bo'lsa — jarima emas, avval izoh (CLAUDE.md §8, UX m5) */}
          {cashDiff !== 0 && (
            <div className="card-minimal space-y-1.5">
              <span className="text-sm font-semibold">Izoh (ixtiyoriy)</span>
              <textarea
                className="field min-h-[80px] text-sm p-3"
                maxLength={500}
                aria-label="Izoh (ixtiyoriy)"
                placeholder="Masalan: mijoz ertaga to'laydi, qaytim berildi…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
          <div className="flex gap-2.5">
            <button
              className="btn min-h-[48px] flex flex-1 items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={18} aria-hidden /> Orqaga
            </button>
            <button
              className="btn-brand min-h-[48px] flex flex-1 items-center justify-center gap-1.5 font-bold shadow-sm active:scale-[0.98] transition"
              onClick={() => setStep(3)}
            >
              Keyingi <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Tasdiq */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card-minimal space-y-2.5 text-sm">
            <div className="font-semibold text-gray-900 dark:text-gray-100 pb-1 border-b border-gray-100 dark:border-gray-800">
              Yakuniy hisobotni tekshirish
            </div>
            <Line label="Sotuvlar soni" value={String(data?.sales_count ?? 0)} />
            <Line label="Sotilgan summa" value={money(data?.sold_amount ?? '0')} />
            <Line label="Qaytariladigan tovar" value={money(returnValue)} />
            <Line label="Topshiriladigan naqd" value={money(cashHanded || '0')} bold />
            <Line
              label="Kassa farqi"
              value={money(cashDiff)}
              danger={cashDiff < 0}
              bold
            />
            {cashDiff !== 0 && note.trim() && (
              <div className="pt-1 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800">
                <span className="font-semibold">Izoh: </span>{note.trim()}
              </div>
            )}
          </div>
          {submit.isError && (
            <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger font-medium border border-danger/20">
              {extractApiError(submit.error)}
            </p>
          )}
          <div className="flex gap-2.5">
            <button
              className="btn min-h-[50px] flex flex-1 items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold"
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={18} aria-hidden /> Orqaga
            </button>
            <button
              className="btn min-h-[50px] flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm active:scale-[0.98] transition disabled:opacity-50"
              disabled={submit.isPending || unsent > 0}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Yopilmoqda…' : 'Kunni yopish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  bold,
  danger,
}: {
  label: string;
  value: string;
  bold?: boolean;
  danger?: boolean;
}): ReactElement {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-bold' : ''} ${danger ? 'text-danger' : ''}`}>
        {value}
      </span>
    </div>
  );
}
