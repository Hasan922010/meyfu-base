import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { businessDateISO } from '@/shared/lib/businessDay';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { InventoryCount } from '@/shared/types/warehouse';

import { InventoryEditor } from './InventoryEditor';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-pending',
  CONFIRMED: 'text-success',
  CANCELLED: 'text-gray-500',
};

export function InventoryTab(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'WAREHOUSE' || role === 'MANAGER' || role === 'BRANCH_MANAGER' ||
    role === 'SUPER_ADMIN';

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<InventoryCount | null>(null);

  const query = useQuery({
    queryKey: ['inventory-counts'],
    queryFn: () => warehouseApi.inventoryCounts({ page_size: 30 }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => warehouseApi.cancelInventoryCount(id),
    onSuccess: () => {
      setCancelling(null);
      void qc.invalidateQueries({ queryKey: ['inventory-counts'] });
    },
  });

  if (openId) {
    return <InventoryEditor countId={openId} onBack={() => setOpenId(null)} />;
  }

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Hujjat ochilganda ombordagi barcha tovarlar hisobdagi qoldig'i bilan
          avtomatik to'ldiriladi — sanab, haqiqiy qoldiqni kiriting.
        </p>
        {canWrite && (
          <button className="btn-brand shrink-0 px-4" onClick={() => setCreating(true)}>
            + Inventarizatsiya
          </button>
        )}
      </div>

      {cancel.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(cancel.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Hali inventarizatsiya o'tkazilmagan"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Ombor</th>
                <th className="p-3">Sana</th>
                <th className="p-3 text-right">Sanalgan</th>
                <th className="p-3 text-right">Farq (so'm)</th>
                <th className="p-3">Holat</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-mono text-xs">{c.number}</td>
                  <td className="p-3">{c.warehouse_name}</td>
                  <td className="p-3">{dateShort(c.date)}</td>
                  <td className="p-3 text-right">
                    {c.counted_count} / {c.items_count}
                  </td>
                  <td className="p-3 text-right">{money(c.difference_amount)}</td>
                  <td className={`p-3 font-medium ${STATUS_CLASS[c.status] ?? ''}`}>
                    {c.status_display}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {canWrite && c.status === 'DRAFT' && (
                        <button
                          className="btn px-3 py-1 text-xs text-danger"
                          onClick={() => setCancelling(c)}
                        >
                          Bekor qilish
                        </button>
                      )}
                      <button
                        className="btn-brand px-3 py-1 text-xs"
                        onClick={() => setOpenId(c.id)}
                      >
                        {canWrite && c.status === 'DRAFT' ? 'Sanash' : "Ko'rish"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={creating} title="Yangi inventarizatsiya" onClose={() => setCreating(false)}>
        <CreateInventoryForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={cancelling !== null}
        title="Inventarizatsiyani bekor qilish"
        confirmLabel="Bekor qilish"
        danger
        isPending={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      >
        {`${cancelling?.number ?? ''} bekor qilinadi. Qoldiqlar o'zgarmaydi.`}
      </ConfirmDialog>
    </div>
  );
}

function CreateInventoryForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}): ReactElement {
  const qc = useQueryClient();
  const [warehouse, setWarehouse] = useState<string>('');
  const [date, setDate] = useState<string>(businessDateISO());
  const [note, setNote] = useState<string>('');

  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      warehouseApi.createInventoryCount({ warehouse, date, ...(note ? { note } : {}) }),
    onSuccess: (count) => {
      void qc.invalidateQueries({ queryKey: ['inventory-counts'] });
      onCreated(count.id);
    },
  });

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Ombor *</span>
        <select className="field" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
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
      <label className="block space-y-1">
        <span className="text-sm font-medium">Izoh (ixtiyoriy)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn px-4" onClick={onCancel}>
          Bekor
        </button>
        <button
          type="button"
          className="btn-brand px-6"
          disabled={!warehouse || !date || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Ochish va to'ldirish
        </button>
      </div>
    </div>
  );
}
