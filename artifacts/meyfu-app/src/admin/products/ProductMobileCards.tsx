import type { ReactElement } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { money, qty } from '@/shared/lib/format';
import type { Product } from '@/shared/types/catalog';

interface Props {
  rows: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (product: Product) => void;
  canWrite: boolean;
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

export function ProductMobileCards({
  rows,
  selectedIds,
  onToggleSelect,
  onEdit,
  canWrite,
}: Props): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {rows.map((p) => {
        const isSelected = selectedIds.has(p.id);
        return (
          <div
            key={p.id}
            className={`relative rounded-xl border p-4 shadow-sm transition-colors bg-white dark:bg-slate-900 ${
              isSelected
                ? 'border-brand ring-1 ring-brand/20 dark:border-brand dark:ring-brand/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-700 dark:bg-slate-800"
                  checked={isSelected}
                  onChange={() => onToggleSelect(p.id)}
                  aria-label={`${p.name} ni tanlash`}
                />
              </div>
              
              <div className="flex-shrink-0">
                {p.image_thumb ? (
                  <img
                    src={p.image_thumb}
                    alt={p.name}
                    className="h-14 w-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageIcon className="h-6 w-6 opacity-50" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {p.name}
                  </h3>
                  {!p.is_active && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Nofaol
                    </span>
                  )}
                </div>
                
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono">{p.sku}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="truncate">{p.category_name}</span>
                  {p.updated_at && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="font-sans text-[10px]">
                        {new Date(p.updated_at).toLocaleDateString('ru')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div>
                <div className="text-xs text-slate-500 mb-0.5 flex justify-between">
                  <span>Chakana</span>
                  <span className="opacity-70" title="Tannarx">{money(p.cost_price)}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {money(p.retail_price)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Mavjud qoldiq</div>
                <div className="flex items-center gap-1.5">
                  <StockBadge status={p.stock_status} />
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                    {qty(p.available_stock ?? 0)} <span className="text-[10px] font-normal text-slate-500">{p.unit_name}</span>
                  </span>
                </div>
              </div>
            </div>

            {canWrite && (
              <div className="mt-3 flex justify-end">
                <button
                  className="text-sm font-medium text-brand hover:underline py-1 px-2"
                  onClick={() => onEdit(p)}
                >
                  Tahrirlash
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
