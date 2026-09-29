import { useQuery } from '@tanstack/react-query';
import { Building2, Truck, Warehouse as WarehouseIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { branchesApi } from '@/shared/api/branches';
import { DataState } from '@/shared/components/DataState';
import { money, qty } from '@/shared/lib/format';

/** Filiallar — har ombor/filial kartochka ko'rinishida, bosilsa faoliyati ochiladi. */
export function BranchesPage(): ReactElement {
  const query = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() });
  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Filiallar</h1>
        <p className="text-sm text-gray-500">
          Asosiy ombor va filiallar — qoldiq, kelayotgan tovar va bugungi harakatlar.
          Filialni bosib, uning barcha faoliyatini ko'ring.
        </p>
      </div>

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Ombor yo'q — «Ma'lumotnomalar → Omborlar» bo'limida qo'shing"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <Link
              key={b.id}
              to={`/admin/branches/${b.id}`}
              className="group space-y-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold group-hover:text-brand">
                    {b.is_branch ? (
                      <Building2 size={18} aria-hidden />
                    ) : (
                      <WarehouseIcon size={18} aria-hidden />
                    )}
                    {b.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.address || '—'}
                    {b.manager_name ? ` · ${b.manager_name}` : ''}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    b.is_branch
                      ? 'bg-brand/10 text-brand'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {b.is_branch ? 'Filial' : 'Asosiy ombor'}
                </span>
              </div>

              <div>
                <div className="text-xs text-gray-500">Qoldiq (tannarx bo'yicha)</div>
                <div className="text-xl font-bold">{money(b.stock_amount)}</div>
                <div className="text-xs text-gray-500">{qty(b.stock_quantity)} dona/birlik</div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                {Number(b.in_transit_quantity) > 0 && (
                  <span className="inline-flex items-center gap-1 text-pending">
                    <Truck size={14} aria-hidden /> Yo'lda: {qty(b.in_transit_quantity)}
                  </span>
                )}
                <span>Bugun: {b.today_movements} ta harakat</span>
              </div>
            </Link>
          ))}
        </div>
      </DataState>
    </div>
  );
}
