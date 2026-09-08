import { Search, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactElement } from 'react';

import { AmountInput } from '@/shared/components/AmountInput';
import { money, numberToWordsUz } from '@/shared/lib/format';
import type { Product } from '@/shared/types/catalog';

export interface LineRow {
  product: string;
  quantity: string;
  price: string;
}

interface Props {
  products: Product[];
  value: LineRow[];
  onChange: (rows: LineRow[]) => void;
  /** Yangi qatorga qaysi narx oldindan qo'yiladi */
  priceSource: 'cost_price' | 'wholesale_price';
  priceLabel: string;
  priceHint?: string;
}

const MAX_RESULTS = 8;

export function ProductLineEditor({
  products,
  value,
  onChange,
  priceSource,
  priceLabel,
  priceHint,
}: Props): ReactElement {
  const [search, setSearch] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const chosen = useMemo(() => new Set(value.map((r) => r.product)), [value]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          !chosen.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)),
      )
      .slice(0, MAX_RESULTS);
  }, [products, search, chosen]);

  function add(p: Product): void {
    const raw = p[priceSource];
    onChange([
      ...value,
      {
        product: p.id,
        quantity: '1',
        price: raw ? String(Math.round(Number(raw))) : '',
      },
    ]);
    setSearch('');
    searchRef.current?.focus();
  }

  function patch(idx: number, p: Partial<LineRow>): void {
    onChange(value.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  }

  function removeAt(idx: number): void {
    onChange(value.filter((_, i) => i !== idx));
  }

  const total = value.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.price) || 0),
    0,
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
          aria-hidden
        />
        <input
          ref={searchRef}
          className="field pl-9"
          placeholder="Mahsulot qidirish — nom, SKU yoki shtrix-kod"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault();
              add(results[0]);
            }
          }}
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => add(p)}
                >
                  <span>
                    {p.name}
                    <span className="ml-2 text-xs text-gray-400">{p.sku}</span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {money(p[priceSource])} / {p.unit_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400 dark:bg-gray-800/50">
          Mahsulot qidirib qo'shing
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2">Mahsulot</th>
                <th className="px-2 py-2 w-24">Soni</th>
                <th className="px-2 py-2 w-32">{priceLabel}</th>
                <th className="px-3 py-2 w-28 text-right">Summa</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {value.map((r, idx) => {
                const p = byId.get(r.product);
                const line =
                  (Number(r.quantity) || 0) * (Number(r.price) || 0);
                return (
                  <tr
                    key={r.product}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-3 py-2">
                      {p?.name ?? '—'}
                      {p && (
                        <span className="ml-1 text-xs text-gray-400">
                          {p.unit_name}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="field h-8 w-20 px-2 py-1"
                        type="number"
                        step="0.001"
                        value={r.quantity}
                        onChange={(e) =>
                          patch(idx, { quantity: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <AmountInput
                        className="h-8 w-28 px-2 py-1"
                        showWords={false}
                        placeholder={priceHint}
                        value={r.price}
                        onChange={(v) => patch(idx, { price: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{money(line)}</td>
                    <td className="px-1">
                      <button
                        type="button"
                        className="p-1 text-danger"
                        onClick={() => removeAt(idx)}
                        aria-label="O'chirish"
                      >
                        <X size={15} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
              <tr>
                <td className="px-3 py-2 font-medium" colSpan={3}>
                  Jami ({value.length})
                  {total > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400 first-letter:uppercase">
                      {numberToWordsUz(Math.round(total))} so'm
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-base font-semibold">
                  {money(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
