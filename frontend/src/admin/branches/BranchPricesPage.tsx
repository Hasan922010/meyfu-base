import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { branchPricesApi, type BranchPrice } from '@/shared/api/branchPrices';
import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { Product } from '@/shared/types/catalog';

type Draft = { wholesale_price: string; retail_price: string; min_price: string };

const FIELDS: Array<{ key: keyof Draft; label: string }> = [
  { key: 'wholesale_price', label: 'Optom' },
  { key: 'retail_price', label: 'Chakana' },
  { key: 'min_price', label: 'Minimal' },
];

/** Filial narxlari: bo'sh qoldirilsa — umumiy narx amal qiladi (v5: A7). */
export function BranchPricesPage(): ReactElement {
  const { id = '' } = useParams();
  const canEdit = useAuthStore((s) => s.user?.role) === 'SUPER_ADMIN';
  const [search, setSearch] = useState<string>('');

  const products = useQuery({
    queryKey: ['products', 'branch-prices'],
    queryFn: () => catalogApi.products({ page_size: 500, is_active: true, ordering: 'name' }),
  });
  const prices = useQuery({
    queryKey: ['branch-prices', id],
    queryFn: () => branchPricesApi.list(id),
  });
  const byProduct = new Map((prices.data ?? []).map((p) => [p.product, p]));
  const needle = search.trim().toLowerCase();
  const rows = (products.data?.results ?? []).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-4">
      <Link to={`/admin/branches/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft size={16} aria-hidden /> Filial
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Filial narxlari</h1>
        <p className="text-sm text-gray-500">
          Faqat farq qiladigan narxlarni kiriting. Bo'sh qoldirilgan tovar — umumiy narxda
          sotiladi. {canEdit ? '' : 'Narxni faqat Super admin o\'zgartiradi.'}
        </p>
      </div>
      <input
        className="field max-w-xs"
        placeholder="Mahsulot yoki SKU"
        aria-label="Qidirish"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={products.isLoading || prices.isLoading}
          isError={products.isError || prices.isError}
          isEmpty={rows.length === 0}
          emptyText="Mahsulot topilmadi"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Mahsulot</th>
                <th className="p-3 text-right">Umumiy narx</th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="p-3">
                    Filial · {f.label}
                  </th>
                ))}
                {canEdit && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PriceRow
                  key={p.id}
                  branch={id}
                  product={p}
                  current={byProduct.get(p.id)}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}

function PriceRow({
  branch,
  product,
  current,
  canEdit,
}: {
  branch: string;
  product: Product;
  current: BranchPrice | undefined;
  canEdit: boolean;
}): ReactElement {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>({
    wholesale_price: current?.wholesale_price ?? '',
    retail_price: current?.retail_price ?? '',
    min_price: current?.min_price ?? '',
  });
  const filled = FIELDS.every((f) => draft[f.key] !== '');
  const empty = FIELDS.every((f) => draft[f.key] === '');

  const save = useMutation({
    mutationFn: async () => {
      if (empty && current) return branchPricesApi.remove(current.id);
      const body = { branch, product: product.id, ...draft };
      return current ? branchPricesApi.update(current.id, body) : branchPricesApi.create(body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['branch-prices', branch] }),
  });

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800">
      <td className="p-3">
        <div>{product.name}</div>
        <div className="text-xs text-gray-400">{product.sku}</div>
        {save.isError && (
          <div className="text-xs text-danger">{extractApiError(save.error)}</div>
        )}
      </td>
      <td className="whitespace-nowrap p-3 text-right text-xs text-gray-500">
        {money(product.wholesale_price)} / {money(product.retail_price)} /{' '}
        {money(product.min_price)}
      </td>
      {FIELDS.map((f) => (
        <td key={f.key} className="p-2">
          <input
            className="field w-28 text-right"
            inputMode="decimal"
            disabled={!canEdit}
            aria-label={`${product.name} — filial ${f.label.toLowerCase()} narxi`}
            placeholder="—"
            value={draft[f.key]}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
        </td>
      ))}
      {canEdit && (
        <td className="p-2 text-right">
          <button
            className="btn-brand px-3 py-1 text-xs"
            disabled={save.isPending || (!filled && !(empty && current))}
            onClick={() => save.mutate()}
          >
            {empty && current ? "O'chirish" : 'Saqlash'}
          </button>
        </td>
      )}
    </tr>
  );
}
