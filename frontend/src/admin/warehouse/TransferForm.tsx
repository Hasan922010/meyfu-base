import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { businessDateISO } from '@/shared/lib/businessDay';
import { qty } from '@/shared/lib/format';
import type { Stock } from '@/shared/types/warehouse';

interface Row {
  product: string;
  quantity: string;
}

/** Yangi ko'chirish: qayerdan → qayerga, tovarlar. Saqlab darhol yuborish mumkin. */
export function TransferForm({ onDone }: { onDone: () => void }): ReactElement {
  const qc = useQueryClient();
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [date, setDate] = useState<string>(businessDateISO());
  const [note, setNote] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<string>('');

  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });
  const stock = useQuery({
    queryKey: ['stock', 'transfer-source', from],
    queryFn: () => warehouseApi.stock({ warehouse: from, page_size: 500 }),
    enabled: Boolean(from),
  });

  const available = (stock.data?.results ?? []).filter(
    (s) => Number(s.available_quantity) > 0,
  );
  const byProduct = new Map<string, Stock>(available.map((s) => [s.product, s]));
  const unpicked = available.filter((s) => !rows.some((r) => r.product === s.product));

  const overLimit = rows.some(
    (r) => Number(r.quantity) > Number(byProduct.get(r.product)?.available_quantity ?? 0),
  );
  const invalid =
    !from || !to || from === to || !date || rows.length === 0 || overLimit ||
    rows.some((r) => !(Number(r.quantity) > 0));

  const save = useMutation({
    mutationFn: async (andSend: boolean) => {
      const created = await warehouseApi.createTransfer({
        from_warehouse: from,
        to_warehouse: to,
        date,
        ...(note ? { note } : {}),
        items: rows,
      });
      return andSend ? warehouseApi.sendTransfer(created.id) : created;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      void qc.invalidateQueries({ queryKey: ['branches'] });
      onDone();
    },
  });

  function changeSource(value: string): void {
    setFrom(value);
    setRows([]);
  }

  function addRow(product: string): void {
    if (!product) return;
    setRows((prev) => [...prev, { product, quantity: '' }]);
    setPicked('');
  }

  function setQuantity(product: string, quantity: string): void {
    setRows((prev) => prev.map((r) => (r.product === product ? { ...r, quantity } : r)));
  }

  function removeRow(product: string): void {
    setRows((prev) => prev.filter((r) => r.product !== product));
  }

  const warehouseOptions = warehouses.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Qayerdan *</span>
          <select className="field" value={from} onChange={(e) => changeSource(e.target.value)}>
            <option value="">—</option>
            {warehouseOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Qayerga *</span>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">—</option>
            {warehouseOptions
              .filter((w) => w.id !== from)
              .map((w) => (
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
        <label className="block space-y-1">
          <span className="text-sm font-medium">Izoh (ixtiyoriy)</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Tovar qo'shish</span>
        <select
          className="field"
          value={picked}
          disabled={!from || stock.isLoading}
          onChange={(e) => addRow(e.target.value)}
        >
          <option value="">
            {from ? (stock.isLoading ? 'Yuklanmoqda…' : 'Tovarni tanlang') : 'Avval omborni tanlang'}
          </option>
          {unpicked.map((s) => (
            <option key={s.product} value={s.product}>
              {s.product_name} — {qty(s.available_quantity)} {s.product_unit}
            </option>
          ))}
        </select>
      </label>

      {rows.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {rows.map((r) => {
            const s = byProduct.get(r.product);
            const tooMuch = Number(r.quantity) > Number(s?.available_quantity ?? 0);
            return (
              <li key={r.product} className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{s?.product_name}</div>
                  <div className={`text-xs ${tooMuch ? 'text-danger' : 'text-gray-500'}`}>
                    Omborda: {qty(s?.available_quantity ?? '0')} {s?.product_unit}
                  </div>
                </div>
                <input
                  className="field w-28 text-right"
                  inputMode="decimal"
                  aria-label={`${s?.product_name ?? ''} miqdori`}
                  value={r.quantity}
                  onChange={(e) => setQuantity(r.product, e.target.value)}
                />
                <button
                  type="button"
                  className="btn p-2 text-danger"
                  aria-label="Qatorni o'chirish"
                  onClick={() => removeRow(r.product)}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {overLimit && (
        <p className="text-sm text-danger">Ba'zi tovarlar omborda yetarli emas — miqdorni kamaytiring.</p>
      )}
      {save.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(save.error)}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn px-4" onClick={onDone}>
          Bekor
        </button>
        <button
          type="button"
          className="btn px-4"
          disabled={invalid || save.isPending}
          onClick={() => save.mutate(false)}
        >
          Qoralama
        </button>
        <button
          type="button"
          className="btn-brand px-6"
          disabled={invalid || save.isPending}
          onClick={() => save.mutate(true)}
        >
          Saqlash va jo'natish
        </button>
      </div>
    </div>
  );
}
