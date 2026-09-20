import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactElement } from 'react';

import { db } from '@/offline/db';
import { qty } from '@/shared/lib/format';

export function MyVanStockPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const rows = useLiveQuery(
    () => db.van_stock.toArray().then((r) => r.sort((a, b) => a.product_name.localeCompare(b.product_name))),
    [],
    [],
  );
  const products = useLiveQuery(() => db.products.toArray(), [], []);
  const thumbById = useMemo(
    () => new Map(products.map((p) => [p.id, p.image_thumb])),
    [products],
  );

  const filtered = rows.filter((v) =>
    v.product_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Mashina qoldig‘i</h1>
      <p className="text-xs text-gray-400">
        Lokal hisob — sotuvdan keyin darhol yangilanadi (CLAUDE.md 4.3)
      </p>
      <input
        className="field"
        placeholder="Qidirish…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ul className="space-y-2">
        {filtered.map((v) => (
          <li
            key={v.product}
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900"
          >
            {thumbById.get(v.product) ? (
              <img
                src={thumbById.get(v.product) ?? ''}
                alt=""
                className="h-11 w-11 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-11 w-11 shrink-0 rounded bg-gray-100 dark:bg-gray-800" />
            )}
            <div className="flex-1">
              <div className="font-medium">{v.product_name}</div>
              <div className="font-mono text-xs text-gray-500">{v.product_sku}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{qty(v.quantity)}</div>
              <div className="text-xs text-gray-500">{v.unit}</div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-8 text-center text-gray-400">Mashinada tovar yo‘q</li>
        )}
      </ul>
    </div>
  );
}
