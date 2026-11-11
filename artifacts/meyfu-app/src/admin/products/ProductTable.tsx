import { Image as ImageIcon, Package } from 'lucide-react';
import type { ReactElement } from 'react';

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

function StockBadge({ status }: { status?: 'out' | 'low' | 'ok' | undefined }): ReactElement {
  if (status === 'out') {
    return (
      <span className="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
        Tugagan
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Kam
      </span>
    );
  }
  return (
    <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      Yetarli
    </span>
  );
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
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <tr>
            {canWrite && (
              <th className="w-12 p-3 text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-700 dark:bg-slate-800"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label="Barchasini tanlash"
                />
              </th>
            )}
            <th className="w-12 p-3" />
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
            {canWrite && <th className="w-20 p-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {rows.map((p) => (
            <tr
              key={p.id}
              className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                selectedIds.has(p.id) ? 'bg-brand/5 dark:bg-brand/10' : ''
              }`}
            >
              {canWrite && (
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-700 dark:bg-slate-800"
                    checked={selectedIds.has(p.id)}
                    onChange={() => onToggleSelect(p.id)}
                    aria-label={`${p.name} ni tanlash`}
                  />
                </td>
              )}
              <td className="p-3">
                {p.image_thumb ? (
                  <img
                    src={p.image_thumb}
                    alt={p.name}
                    className="h-10 w-10 min-w-[40px] rounded-lg border border-slate-200 bg-white object-cover dark:border-slate-700"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    <ImageIcon className="h-5 w-5 opacity-50" />
                  </div>
                )}
              </td>
              <td className="p-3">
                <div className="line-clamp-2 font-medium leading-snug text-slate-900 dark:text-white">
                  {p.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
                  <span title="SKU">{p.sku}</span>
                  {p.barcode && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span title="Shtrix-kod">{p.barcode}</span>
                    </>
                  )}
                  {p.has_bonus && (
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-brand">
                      +{Number(p.bonus_reward_qty)} bonus
                    </span>
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
                  <div className="mt-0.5 text-xs text-slate-500">{p.brand_name}</div>
                )}
              </td>
              <td className="p-3 text-right">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {money(p.retail_price)}
                </div>
                <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-slate-500">
                  <span title="Tannarx / Ulgurji / Min">
                    Tan: {money(p.cost_price)} | Ulg: {money(p.wholesale_price)} | Min:{' '}
                    {money(p.min_price)}
                  </span>
                  {(Number(p.order_commission_rate || 0) > 0 ||
                    Number(p.delivery_commission_rate || 0) > 0) && (
                    <span title="Komissiya (Zakaz / Yetkazish)">
                      Kom: {Number(p.order_commission_rate || 0)}% /{' '}
                      {Number(p.delivery_commission_rate || 0)}%
                    </span>
                  )}
                </div>
              </td>
              <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <StockBadge status={p.stock_status} />
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                      {qty(p.available_stock ?? 0)}{' '}
                      <span className="text-xs font-normal text-slate-500">{p.unit_name}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <span title="Qadoq soni">Qadoq: {p.pack_quantity}</span>
                  </div>
                  {Number(p.reserved_stock ?? 0) > 0 && (
                    <div
                      className="flex items-center gap-1 text-[11px] text-slate-500"
                      title="Bant qilingan / Jami"
                    >
                      <Package className="h-3 w-3" />
                      Bant: {qty(p.reserved_stock ?? 0)} / Jami: {qty(p.total_stock ?? 0)}
                    </div>
                  )}
                </div>
              </td>
              <td className="p-3 text-center">
                {p.is_active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Faol
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Nofaol
                  </span>
                )}
              </td>
              {canWrite && (
                <td className="p-3 text-right">
                  <button
                    className="rounded-lg p-2 text-sm font-medium text-brand transition-colors hover:bg-brand/10 hover:text-brand-hover"
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
