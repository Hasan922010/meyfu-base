import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { apiErrorCode, extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';
import type { InventoryCount } from '@/shared/types/warehouse';

import {
  changedRows,
  filterRows,
  rebasedCountedRows,
  summarize,
  type Drafts,
  type RowFilter,
} from './inventory';
import { InventoryRows } from './InventoryRows';

const FILTERS: Array<{ id: RowFilter; label: string }> = [
  { id: 'all', label: 'Hammasi' },
  { id: 'diff', label: 'Farqlilar' },
  { id: 'uncounted', label: 'Sanalmaganlar' },
];

interface Props {
  countId: string;
  onBack: () => void;
}

export function InventoryEditor({ countId, onBack }: Props): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  // Omborchi sanaydi, qoldiqni tuzatishni rahbar tasdiqlaydi (backend bilan bir xil)
  const canConfirm = role === 'MANAGER' || role === 'BRANCH_MANAGER' || role === 'SUPER_ADMIN';
  const canWrite = canConfirm || role === 'WAREHOUSE';

  const [drafts, setDrafts] = useState<Drafts>({});
  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState<string>('');
  const [confirming, setConfirming] = useState<boolean>(false);
  // Yangilashdan keyin "Hisobda" o'zgargan sanalgan tovarlar (farqni qayta ko'rish uchun)
  const [rebased, setRebased] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ['inventory-count', countId],
    queryFn: () => warehouseApi.inventoryCount(countId),
  });
  const count = query.data;
  const items = count?.items ?? [];
  const editable = canWrite && count?.status === 'DRAFT';
  const pending = changedRows(items, drafts);

  const onSaved = (fresh: InventoryCount): void => {
    qc.setQueryData(['inventory-count', countId], fresh);
    void qc.invalidateQueries({ queryKey: ['inventory-counts'] });
    setDrafts({});
  };
  // Kiritilganlar yo'qolmasin — har amal oldidan saqlanmaganlar yuboriladi
  const flush = async (): Promise<void> => {
    if (pending.length > 0) await warehouseApi.saveInventoryItems(countId, pending);
  };

  const save = useMutation({
    mutationFn: () => warehouseApi.saveInventoryItems(countId, pending),
    onSuccess: onSaved,
  });
  const refresh = useMutation({
    mutationFn: async () => {
      await flush();
      return warehouseApi.fillInventoryCount(countId);
    },
    onSuccess: (fresh) => {
      setRebased(rebasedCountedRows(items, fresh.items ?? []).map((i) => i.product_name));
      onSaved(fresh);
    },
  });
  const confirm = useMutation({
    mutationFn: async () => {
      await flush();
      return warehouseApi.confirmInventoryCount(countId);
    },
    onSuccess: (fresh) => {
      setConfirming(false);
      onSaved(fresh);
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: () => {
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ['inventory-count', countId] });
    },
  });

  const fillUncountedWithZero = (): void => {
    const zeros = Object.fromEntries(
      filterRows(items, drafts, 'uncounted', '').map((item) => [item.id, '0']),
    );
    setDrafts({ ...drafts, ...zeros });
  };

  const summary = summarize(items, drafts);
  const visible = filterRows(items, drafts, filter, search);
  const isStale = apiErrorCode(confirm.error) === 'STALE_STOCK';
  const busy = save.isPending || refresh.isPending || confirm.isPending;
  const error = save.error ?? refresh.error ?? confirm.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="btn px-3 py-1 text-sm" onClick={onBack}>
          ← Ro'yxatga
        </button>
        {count && (
          <div className="text-sm text-gray-500">
            <span className="font-mono">{count.number}</span> · {count.warehouse_name} ·{' '}
            {dateShort(count.date)} · {count.status_display}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <SummaryCard label="Sanalgan" value={`${summary.counted} / ${items.length}`} />
        <SummaryCard label="Sanalmagan" value={String(summary.uncounted)} />
        <SummaryCard label="Ortiqcha" value={money(summary.surplusAmount)} tone="text-success" />
        <SummaryCard label="Yetishmaydi" value={money(summary.shortageAmount)} tone="text-danger" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-xs"
          placeholder="Tovar nomi yoki SKU"
          aria-label="Tovar qidirish"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`btn px-3 py-1 text-sm ${filter === f.id ? 'border-brand text-brand' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        {editable && summary.uncounted > 0 && (
          <button className="btn px-3 py-1 text-sm" onClick={fillUncountedWithZero}>
            Sanalmaganlarni 0 qilish
          </button>
        )}
      </div>

      {Boolean(error) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          <span>{extractApiError(error)}</span>
          {isStale && (
            <button
              className="btn px-3 py-1 text-xs"
              disabled={busy}
              onClick={() => refresh.mutate()}
            >
              Hisobdagi qoldiqni yangilash
            </button>
          )}
        </div>
      )}

      {rebased.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg bg-pending/10 px-3 py-2 text-sm text-pending"
        >
          <span>
            {`${rebased.length} ta sanalgan tovarning hisobdagi qoldig'i o'zgardi — farqni qayta tekshiring: `}
            {rebased.slice(0, 5).join(', ')}
            {rebased.length > 5 ? '…' : ''}
          </span>
          <button className="btn px-2 py-0.5 text-xs" onClick={() => setRebased([])}>
            Tushunarli
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && visible.length === 0}
          emptyText="Bu filtr bo'yicha tovar yo'q"
        >
          <InventoryRows
            items={visible}
            drafts={drafts}
            editable={editable}
            onChange={(id, value) => setDrafts({ ...drafts, [id]: value })}
          />
        </DataState>
      </div>

      {editable && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 bg-gray-50/90 py-2 dark:bg-gray-950/90">
          {pending.length > 0 && (
            <span className="text-sm text-pending">Saqlanmagan: {pending.length} ta</span>
          )}
          <button className="btn px-4" disabled={busy} onClick={() => refresh.mutate()}>
            Hisobni yangilash
          </button>
          <button
            className="btn px-4"
            disabled={busy || pending.length === 0}
            onClick={() => save.mutate()}
          >
            Saqlash
          </button>
          {canConfirm && (
            <button
              className="btn-brand px-6"
              disabled={busy || summary.counted === 0}
              onClick={() => setConfirming(true)}
            >
              Tasdiqlash
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Inventarizatsiyani tasdiqlash"
        confirmLabel="Tasdiqlash"
        isPending={confirm.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => confirm.mutate()}
      >
        {`${summary.counted} ta sanalgan tovar qoldig'i haqiqiy miqdorga tenglashtiriladi. ` +
          `Sanalmagan ${summary.uncounted} ta tovar o'zgarmaydi. ` +
          'Tasdiqlangandan keyin hujjatni tahrirlab bo‘lmaydi.'}
      </ConfirmDialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = '',
}: {
  label: string;
  value: string;
  tone?: string;
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}
