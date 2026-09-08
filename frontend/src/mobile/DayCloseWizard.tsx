import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CircleCheckBig, ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

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
        quantity: v.quantity,
        condition: 'GOOD',
      })),
    );
    setCashHanded(data.cash_expected ?? '');
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

  const submit = useMutation({
    mutationFn: () =>
      dayCloseApi.submit({
        warehouse: warehouses.data?.results[0]?.id ?? '',
        cash_handed: cashHanded || '0',
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
        <button className="btn-brand px-6" onClick={() => navigate('/m')}>
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
        <button className="btn-brand px-6" onClick={() => navigate('/m')}>
          Bosh sahifa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {(['Tovar', 'Pul', 'Tasdiq'] as const).map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i + 1
                ? 'bg-brand text-brand-fg'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
            }`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {/* STEP 1 — Tovar */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Mashinadagi qolgan tovarni sanab, qaytariladigan miqdorni kiriting.
          </p>
          {rows.map((r, idx) => (
            <div
              key={r.product}
              className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium">{r.product_name}</span>
                <span className="text-gray-400">tizimda: {r.suggested} {r.unit}</span>
              </div>
              <div className="flex gap-2">
                <input
                  className="field w-24"
                  type="number"
                  step="0.001"
                  value={r.quantity}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, quantity: e.target.value } : x,
                      ),
                    )
                  }
                />
                <select
                  className="field flex-1"
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
          ))}
          {rows.length === 0 && (
            <p className="text-gray-400">Mashinada tovar yo'q — qaytarish shart emas.</p>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Qaytariladigan summa</span>
            <span className="font-semibold">{money(returnValue)}</span>
          </div>
          <button
            className="btn-brand flex w-full items-center justify-center gap-1.5"
            onClick={() => setStep(2)}
          >
            Keyingi: Pul <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* STEP 2 — Pul */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
            <Line label="Naqd sotuv" value={money(data?.cash_sales_amount ?? '0')} />
            <Line label="Undirilgan qarz" value={money(data?.debt_collected_amount ?? '0')} />
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <Line label="Kutilgan naqd" value={money(data?.cash_expected ?? '0')} bold />
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Topshirilayotgan naqd</span>
            <input
              className="field text-lg"
              type="number"
              inputMode="decimal"
              value={cashHanded}
              onChange={(e) => setCashHanded(e.target.value)}
            />
          </label>
          <div
            className={`rounded-lg p-3 text-sm ${
              cashDiff < 0
                ? 'bg-danger/10 text-danger'
                : cashDiff > 0
                  ? 'bg-pending/10 text-pending'
                  : 'bg-success/10 text-success'
            }`}
          >
            {cashDiff === 0
              ? 'Kassa farqi yo\'q'
              : `Kassa farqi: ${money(cashDiff)}${cashDiff < 0 ? ' (kamomad)' : ''}`}
          </div>
          <div className="flex gap-2">
            <button
              className="btn flex flex-1 items-center justify-center gap-1.5"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={16} aria-hidden /> Orqaga
            </button>
            <button
              className="btn-brand flex flex-1 items-center justify-center gap-1.5"
              onClick={() => setStep(3)}
            >
              Keyingi <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Tasdiq */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
            <Line label="Sotuvlar soni" value={String(data?.sales_count ?? 0)} />
            <Line label="Sotilgan summa" value={money(data?.sold_amount ?? '0')} />
            <Line label="Qaytariladigan tovar" value={money(returnValue)} />
            <Line label="Topshiriladigan naqd" value={money(cashHanded || '0')} />
            <Line
              label="Kassa farqi"
              value={money(cashDiff)}
              danger={cashDiff < 0}
            />
          </div>
          {submit.isError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {extractApiError(submit.error)}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="btn flex flex-1 items-center justify-center gap-1.5"
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} aria-hidden /> Orqaga
            </button>
            <button
              className="btn-brand flex-1"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              Kunni yopish
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
