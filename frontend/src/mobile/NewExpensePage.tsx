import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CircleCheckBig } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCurrentCoords } from '@/mobile/geo';
import { saveExpenseLocal } from '@/offline/actions';
import { expensesApi } from '@/shared/api/finance';
import { ocrApi } from '@/shared/api/ocr';
import { AmountInput } from '@/shared/components/AmountInput';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';

const QUICK = [10000, 20000, 50000, 100000, 200000];
const SOURCES: Array<{ v: 'CASH_ON_HAND' | 'OWN_MONEY' | 'COMPANY_CARD'; label: string }> = [
  { v: 'CASH_ON_HAND', label: "Qo'ldagi naqd" },
  { v: 'OWN_MONEY', label: 'Shaxsiy pul' },
  { v: 'COMPANY_CARD', label: 'Kompaniya kartasi' },
];

export function NewExpensePage(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expensesApi.categories(),
  });

  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<'CASH_ON_HAND' | 'OWN_MONEY' | 'COMPANY_CARD'>(
    'CASH_ON_HAND',
  );
  const [description, setDescription] = useState<string>('');
  const [done, setDone] = useState<boolean>(false);

  const selectedCat = categories.data?.results.find((c) => c.id === category);

  const receipt = useMutation({
    mutationFn: (file: File) => ocrApi.receiptScan(file),
    onSuccess: (r) => {
      if (r.total) setAmount(String(Math.round(Number(r.total))));
      if (r.supplier && !description) setDescription(r.supplier);
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentCoords();
      return saveExpenseLocal({
        category,
        category_name: selectedCat?.name ?? '',
        amount: Number(amount),
        payment_source: source,
        description,
        ...(coords ?? {}),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      setDone(true);
    },
  });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Xarajat saqlandi</h1>
        <p className="text-gray-500">Admin tasdiqlashini kuting.</p>
        <div className="flex gap-2 pt-2">
          <button className="btn px-5" onClick={() => navigate('/m')}>
            Bosh sahifa
          </button>
          <button
            className="btn-brand px-5"
            onClick={() => {
              setDone(false);
              setAmount('');
              setDescription('');
            }}
          >
            Yana
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Yangi xarajat</h1>

      <DataState isLoading={categories.isLoading} isError={categories.isError}>
        <div className="grid grid-cols-3 gap-2">
          {categories.data?.results.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl p-3 text-xs ${
                category === c.id
                  ? 'bg-brand text-brand-fg'
                  : 'bg-white shadow-sm dark:bg-gray-900'
              }`}
            >
              <span className="text-2xl">{c.icon || '💸'}</span>
              {c.name}
            </button>
          ))}
        </div>
      </DataState>

      <div>
        <AmountInput
          className="text-center text-2xl font-bold"
          value={amount}
          onChange={setAmount}
        />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {QUICK.map((n) => (
            <button
              key={n}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800"
              onClick={() => setAmount(String(n))}
            >
              {money(n).replace(" so'm", '')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.v}
            onClick={() => setSource(s.v)}
            className={`flex-1 rounded-lg py-2 text-xs ${
              source === s.v
                ? 'bg-brand text-brand-fg'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <input
        className="field"
        placeholder="Izoh (ixtiyoriy)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2 text-sm text-gray-500 dark:border-gray-700">
        <Camera size={16} aria-hidden />
        {receipt.isPending ? 'Chek o‘qilmoqda…' : 'Chek rasmidan summani olish'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) receipt.mutate(f);
          }}
        />
      </label>

      {selectedCat?.requires_receipt && (
        <p className="rounded-lg bg-pending/10 px-3 py-2 text-xs text-pending">
          Bu kategoriya uchun chek rasmi kerak — keyinroq admin panelda qo'shing.
        </p>
      )}

      <button
        className="btn-brand w-full"
        disabled={!category || Number(amount) <= 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Saqlash
      </button>
    </div>
  );
}
