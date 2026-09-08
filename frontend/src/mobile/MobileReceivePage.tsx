import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheckBig, Search, X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { AmountInput } from '@/shared/components/AmountInput';
import { DataState } from '@/shared/components/DataState';
import { money, numberToWordsUz } from '@/shared/lib/format';

interface Row {
  product: string;
  name: string;
  unit: string;
  quantity: string;
  price: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MobileReceivePage(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => warehouseApi.suppliers({ page_size: 200 }),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => catalogApi.products({ page_size: 1000, is_active: true }),
  });

  const [supplier, setSupplier] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [invoice, setInvoice] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState<string>('');

  const chosen = useMemo(() => new Set(rows.map((r) => r.product)), [rows]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (products.data?.results ?? [])
      .filter(
        (p) =>
          !chosen.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [products.data, search, chosen]);

  const total = rows.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.price) || 0),
    0,
  );

  const save = useMutation({
    mutationFn: () =>
      warehouseApi.createPurchase({
        supplier,
        warehouse,
        date: today(),
        invoice_number: invoice,
        items: rows
          .filter((r) => Number(r.quantity) > 0)
          .map((r) => ({
            product: r.product,
            quantity: r.quantity,
            cost_price: r.price || '0',
          })),
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      setDone(p.number);
    },
  });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CircleCheckBig size={56} className="text-success" aria-hidden />
        <h1 className="text-xl font-bold">Qabul saqlandi</h1>
        <p className="text-gray-500">{done} · qoralama sifatida</p>
        <p className="text-sm text-gray-400">
          Tasdiqlash — admin panelida yoki menejer tomonidan.
        </p>
        <div className="flex gap-2 pt-2">
          <button className="btn px-5" onClick={() => navigate('/m')}>
            Bosh sahifa
          </button>
          <button
            className="btn-brand px-5"
            onClick={() => {
              setDone('');
              setRows([]);
              setInvoice('');
            }}
          >
            Yana qabul
          </button>
        </div>
      </div>
    );
  }

  const valid = supplier && warehouse && rows.some((r) => Number(r.quantity) > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tovar qabuli</h1>

      <DataState
        isLoading={suppliers.isLoading || warehouses.isLoading}
        isError={suppliers.isError || warehouses.isError}
      >
        <div className="space-y-2">
          <select
            className="field"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Yetkazib beruvchi…</option>
            {suppliers.data?.results.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">Ombor…</option>
            {warehouses.data?.results.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Nakladnoy raqami (ixtiyoriy)"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
          />
        </div>
      </DataState>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-3 text-gray-400"
          aria-hidden
        />
        <input
          className="field pl-9"
          placeholder="Mahsulot qidirish — nom, SKU, shtrix-kod"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => {
                    setRows((prev) => [
                      ...prev,
                      {
                        product: p.id,
                        name: p.name,
                        unit: p.unit_name,
                        quantity: '1',
                        price: p.cost_price
                          ? String(Math.round(Number(p.cost_price)))
                          : '',
                      },
                    ]);
                    setSearch('');
                  }}
                >
                  <span>
                    {p.name}
                    <span className="ml-1 text-xs text-gray-400">{p.sku}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {money(p.cost_price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm dark:bg-gray-900">
          Mahsulot qidirib qo'shing
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, idx) => (
            <li
              key={r.product}
              className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {r.name}
                  <span className="ml-1 text-xs text-gray-400">{r.unit}</span>
                </span>
                <button
                  className="p-1 text-danger"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="O'chirish"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 space-y-0.5">
                  <span className="text-xs text-gray-500">Soni</span>
                  <input
                    className="field h-10"
                    type="number"
                    inputMode="decimal"
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
                </label>
                <div className="flex-1 space-y-0.5">
                  <span className="text-xs text-gray-500">Kelish narxi</span>
                  <AmountInput
                    className="h-10"
                    showWords={false}
                    value={r.price}
                    onChange={(v) =>
                      setRows((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, price: v } : x)),
                      )
                    }
                  />
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                {money((Number(r.quantity) || 0) * (Number(r.price) || 0))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <span className="text-sm text-gray-500">Jami ({rows.length})</span>
          <div className="text-right">
            <div className="text-lg font-bold">{money(total)}</div>
            {total > 0 && (
              <div className="text-xs text-gray-400 first-letter:uppercase">
                {numberToWordsUz(Math.round(total))} so'm
              </div>
            )}
          </div>
        </div>
      )}

      {save.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(save.error)}
        </p>
      )}

      <button
        className="btn-brand w-full"
        disabled={!valid || save.isPending}
        onClick={() => save.mutate()}
      >
        Qabulni saqlash
      </button>
    </div>
  );
}
