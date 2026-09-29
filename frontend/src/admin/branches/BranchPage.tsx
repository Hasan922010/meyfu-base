import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { branchesApi, type BranchCard } from '@/shared/api/branches';
import { DataState } from '@/shared/components/DataState';
import { PeriodSwitcher } from '@/shared/components/PeriodSwitcher';
import { dateShort, money, qty } from '@/shared/lib/format';

import { usePeriodParam } from './usePeriodParam';

const TONE: Record<string, string> = {
  stock: 'border-brand',
  in_transit: 'border-pending',
  purchases: 'border-success',
  transfers_in: 'border-success',
  returns: 'border-success',
  opening: 'border-success',
  transfers_out: 'border-expense',
  loadings: 'border-expense',
  write_offs: 'border-danger',
  inventory: 'border-gray-300',
  other: 'border-gray-300',
};

/** Kartaning ostidagi yozuv — nima sanalgani (hujjat yoki tovar turi). */
function countLabel(card: BranchCard): string {
  if (card.kind === 'stock') return `${card.count} xil tovar`;
  if (card.kind === 'in_transit') return `${card.count} ta ko'chirish`;
  return `${card.count} ta hujjat`;
}

function ChangeBadge({ change }: { change: number | null }): ReactElement | null {
  if (change === null) return null;
  const up = change >= 0;
  return (
    <span className={`text-xs ${up ? 'text-success' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  );
}

export function BranchPage(): ReactElement {
  const { id = '' } = useParams();
  const [preset, setPreset] = usePeriodParam();
  const query = useQuery({
    queryKey: ['branch-cards', id, preset],
    queryFn: () => branchesApi.cards(id, { preset }),
  });
  const data = query.data;

  return (
    <div className="space-y-4">
      <Link to="/admin/branches" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft size={16} aria-hidden /> Filiallar
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data?.warehouse.name ?? '…'}</h1>
          {data && (
            <p className="text-sm text-gray-500">
              {data.warehouse.is_branch ? 'Filial' : 'Asosiy ombor'}
              {data.warehouse.manager_name ? ` · mas'ul: ${data.warehouse.manager_name}` : ''}
              {' · '}
              {dateShort(data.date_from)} – {dateShort(data.date_to)}
            </p>
          )}
        </div>
        <PeriodSwitcher value={preset} onChange={setPreset} />
      </div>

      <DataState isLoading={query.isLoading} isError={query.isError} isEmpty={false}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.cards.map((card) => (
            <Link
              key={card.kind}
              to={`/admin/branches/${id}/${card.kind}?preset=${preset}`}
              className={`space-y-1 rounded-xl border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand dark:bg-gray-900 ${
                TONE[card.kind] ?? 'border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-gray-500">{card.label}</span>
                <ChangeBadge change={card.change} />
              </div>
              <div className="text-xl font-bold">{money(card.amount)}</div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{countLabel(card)}</span>
                <span>{qty(card.quantity)}</span>
              </div>
              {Boolean(card.low_count) && (
                <div className="text-xs text-danger">Kam qolgan: {card.low_count}</div>
              )}
            </Link>
          ))}
        </div>
      </DataState>
    </div>
  );
}
