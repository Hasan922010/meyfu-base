import type { ReactElement } from 'react';
import { Package, Image as ImageIcon } from 'lucide-react';

import { money, qty } from '@/shared/lib/format';
import type { Product } from '@/shared/types/catalog';
import { SortableHeader } from './SortableHeader';

interface Props {
  rows: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (product: Product) => void;
  canWrite: boolean;
  ordering: string;
  onSort: (field: string) => void;
}

function StockBadge({ status }: { status?: 'out' | 'low' | 'ok' }) {
  if (status === 'out') {
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Tugagan</span>;
  }
  if (status === 'low') {
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Kam</span>;
  }
  return <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Yetarli</span>;
}

export function ProductTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onEdit,
  canWrite,
  ordering,
  onSort,
}: Props): ReactElement {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div className="hidden md:block overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <tr>
            <th className="p-3 w-12 text-center">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-700 dark:bg-slate-800"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={onToggleAll}
                aria-label="Barchasini tanlash"
              />
            </th>
            <th className="p-3 w-12" />
            <SortableHeader field="name" currentOrdering={ordering} onSort={onSort}>
              Mahsulot
            </SortableHeader>
            <SortableHeader field="category__name" currentOrdering={ordering} onSort={onSort}>
              Kategoriya / Brend
            </SortableHeader>
            <SortableHeader field="retail_price" currentOrdering={ordering} onSort={onSort} align="right">
              Narxlar
            </SortableHeader>
            <SortableHeader field="available_stock" currentOrdering={ordering} onSort={onSort} align="right">
              Zaxira
            </SortableHeader>
            <SortableHeader field="is_active" currentOrdering={ordering} onSort={onSort} align="center">
              Holat
            </SortableHeader>
            {canWrite && <th className="p-3 w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {rows.map((p) => (
            <tr
              key={p.id}
              className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                selectedIds.has(p.id) ? 'bg-brand/5 dark:bg-brand/10' : ''
              }`}
            >
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-700 dark:bg-slate-800"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onToggleSelect(p.id)}
                  aria-label={`${p.name} ni tanlash`}
                />
              </td>
              <td className="p-3">
                {p.image_thumb ? (
                  <img
                    src={p.image_thumb}
                    alt={p.name}
                    className="h-10 w-10 min-w-[40px] rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-10 min-w-[40px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageIcon className="h-5 w-5 opacity-50" />
                  </div>
                )}
              </td>
              <td className="p-3">
                <div className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                  {p.name}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span title="SKU">{p.sku}</span>
                  {p.barcode && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span title="Shtrix-kod">{p.barcode}</span>
                    </>
                  )}
                  {p.updated_at && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span title="Yangilangan sana" className="font-sans text-[10px]">
                        {new Date(p.updated_at).toLocaleDateString('ru')}
                      </span>
                    </>
                  )}
                </div>
              </td>
              <td className="p-3">
                <div className="text-slate-800 dark:text-slate-200">{p.category_name}</div>
                {p.brand_name && (
                  <div className="text-xs text-slate-500 mt-0.5">{p.brand_name}</div>
                )}
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {money(p.retail_price)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-col gap-0.5">
                  <span title="Tannarx / Ulgurji / Min">
                    Tan: {money(p.cost_price)} | Ulg: {money(p.wholesale_price)} | Min: {money(p.min_price)}
                  </span>
                </div>
              </td>
              <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <StockBadge status={p.stock_status} />
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      {qty(p.available_stock ?? 0)} <span className="text-xs font-normal text-slate-500">{p.unit_name}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <span title="Qadoq soni">Qadoq: {p.pack_quantity}</span>
                  </div>
                  {((p.reserved_stock ?? 0) > 0) && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1" title="Bant qilingan / Jami">
                      <Package className="h-3 w-3" />
                      Bant: {qty(p.reserved_stock ?? 0)} / Jami: {qty(p.total_stock ?? 0)}
                    </div>
                  )}
                </div>
              </td>
              <td className="p-3 text-center">
                {p.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Faol
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    Nofaol
                  </span>
                )}
              </td>
              {canWrite && (
                <td className="p-3 text-right">
                  <button
                    className="text-brand hover:text-brand-hover hover:bg-brand/10 p-2 rounded-lg transition-colors font-medium text-sm"
                    onClick={() => onEdit(p)}
                    aria-label={`${p.name} ni tahrirlash`}
                  >
                    Tahrirlash
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
