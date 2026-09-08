import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';

import { ProductLineEditor, type LineRow } from './ProductLineEditor';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseForm({ onDone }: { onDone: () => void }): ReactElement {
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
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [date, setDate] = useState<string>(today());
  const [rows, setRows] = useState<LineRow[]>([]);

  const mutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter((r) => r.product && Number(r.quantity) > 0)
        .map((r) => ({
          product: r.product,
          quantity: r.quantity,
          cost_price: r.price || '0',
        }));
      return warehouseApi.createPurchase({
        supplier,
        warehouse,
        date,
        items,
        ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      onDone();
    },
  });

  const valid =
    supplier &&
    warehouse &&
    rows.some((r) => r.product && Number(r.quantity) > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Yetkazib beruvchi *</span>
          <select
            className="field"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">—</option>
            {suppliers.data?.results.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
          <span className="text-sm font-medium">Nakladnoy raqami</span>
          <input
            className="field"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
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

      <ProductLineEditor
        products={products.data?.results ?? []}
        value={rows}
        onChange={setRows}
        priceSource="cost_price"
        priceLabel="Kelish narxi"
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
          Qoralama saqlash
        </button>
      </div>
    </div>
  );
}
