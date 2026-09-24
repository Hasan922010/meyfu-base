import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { authApi } from '@/shared/api/users';
import { warehouseApi } from '@/shared/api/warehouse';
import type { Loading } from '@/shared/types/warehouse';

import { ProductLineEditor, type LineRow } from './ProductLineEditor';
import { businessDateISO } from '@/shared/lib/businessDay';

function today(): string {
  return businessDateISO();
}

interface Props {
  /** Berilsa — shu qoralama tahrirlanadi */
  loading?: Loading | null;
  onDone: () => void;
}

/** "5000.000" -> "5000": miqdor maydonida ortiqcha kasr nollari ko'rinmasin */
function plainQty(q: string): string {
  return String(Number(q));
}

export function LoadingForm({ loading = null, onDone }: Props): ReactElement {
  const qc = useQueryClient();

  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: () => authApi.distributors(),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => catalogApi.products({ page_size: 1000, is_active: true }),
  });

  const [distributor, setDistributor] = useState<string>(loading?.distributor ?? '');
  const [warehouse, setWarehouse] = useState<string>(loading?.warehouse ?? '');
  const [date, setDate] = useState<string>(loading?.date ?? today());
  const [rows, setRows] = useState<LineRow[]>(
    () =>
      loading?.items.map((i) => ({
        product: i.product,
        quantity: plainQty(i.quantity),
        price: i.price ?? '',
      })) ?? [],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter((r) => r.product && Number(r.quantity) > 0)
        .map((r) => ({
          product: r.product,
          quantity: r.quantity,
          ...(r.price ? { price: r.price } : {}),
        }));
      const body = { distributor, warehouse, date, items };
      return loading
        ? warehouseApi.updateLoading(loading.id, body)
        : warehouseApi.createLoading(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loadings'] });
      onDone();
    },
  });

  const valid =
    distributor &&
    warehouse &&
    rows.some((r) => r.product && Number(r.quantity) > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tarqatuvchi *</span>
          <select
            className="field"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
          >
            <option value="">—</option>
            {distributors.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ombor *</span>
          <select
            className="field"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">—</option>
            {warehouses.data?.results.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Sana *</span>
          <input
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Narx bo'sh qoldirilsa — mahsulotning optom narxi qo'llanadi.
      </p>
      <ProductLineEditor
        products={products.data?.results ?? []}
        value={rows}
        onChange={setRows}
        priceSource="wholesale_price"
        priceLabel="Narx"
        priceHint="optom"
      />

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn px-4">
          Bekor
        </button>
        <button
          type="button"
          className="btn-brand px-6"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {loading ? 'Saqlash' : 'Qoralama saqlash'}
        </button>
      </div>
    </div>
  );
}
