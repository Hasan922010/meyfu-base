import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { ordersApi, type Order, type OrderStatus } from '@/shared/api/orders';
import { authApi } from '@/shared/api/users';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';

type Tab = 'list' | 'build';

const STATUS_CLASS: Record<OrderStatus, string> = {
  DRAFT: 'text-gray-400',
  PLACED: 'text-pending',
  APPROVED: 'text-brand',
  LOADED: 'text-brand',
  DELIVERED: 'text-success',
  PARTIALLY_DELIVERED: 'text-pending',
  CANCELLED: 'text-danger',
};

const STATUS_FILTERS: Array<{ v: string; l: string }> = [
  { v: '', l: 'Hammasi' },
  { v: 'PLACED', l: 'Berilgan' },
  { v: 'APPROVED', l: 'Tasdiqlangan' },
  { v: 'LOADED', l: 'Yuklamada' },
  { v: 'DELIVERED', l: 'Yetkazilgan' },
  { v: 'PARTIALLY_DELIVERED', l: 'Qisman' },
  { v: 'CANCELLED', l: 'Bekor' },
];

export function OrdersPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('list');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buyurtmalar</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(
          [
            { id: 'list', l: 'Ro‘yxat' },
            { id: 'build', l: 'Yuklamaga yig‘ish' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'list' ? <ListTab /> : <BuildLoadingTab />}
    </div>
  );
}

function ListTab(): ReactElement {
  const [status, setStatus] = useState<string>('');
  const [open, setOpen] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['orders', { status }],
    queryFn: () =>
      ordersApi.list({
        page_size: 100,
        ordering: '-date',
        ...(status ? { status } : {}),
      }),
  });
  const rows = list.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.v}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              status === f.v
                ? 'bg-brand text-brand-fg'
                : 'bg-white text-gray-600 dark:bg-gray-900 dark:text-gray-300'
            }`}
            onClick={() => setStatus(f.v)}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={!list.isLoading && rows.length === 0}
          emptyText="Buyurtma yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Sana</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Zakaz oldi</th>
                <th className="p-3">Yetkazuvchi</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  onClick={() => setOpen(o.id)}
                >
                  <td className="p-3 font-mono text-xs">{o.number}</td>
                  <td className="p-3">{dateShort(o.date)}</td>
                  <td className="p-3 font-medium">{o.client_name}</td>
                  <td className="p-3">{o.taken_by_name}</td>
                  <td className="p-3 text-gray-500">{o.assigned_to_name ?? '—'}</td>
                  <td className="p-3 text-right">{money(o.total_amount)}</td>
                  <td className={`p-3 ${STATUS_CLASS[o.status]}`}>
                    {o.status_display}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      {open && <OrderModal orderId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function OrderModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const [reason, setReason] = useState<string>('');

  const q = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
  });

  const refresh = (): void => {
    void qc.invalidateQueries({ queryKey: ['order', orderId] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const approve = useMutation({
    mutationFn: () => ordersApi.approve(orderId),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderId, reason),
    onSuccess: refresh,
  });

  const o = q.data;
  const err = approve.error ?? cancel.error;
  const canApprove = o?.status === 'DRAFT' || o?.status === 'PLACED';
  const canCancel =
    o != null &&
    ['DRAFT', 'PLACED', 'APPROVED', 'LOADED'].includes(o.status);

  return (
    <Modal open title="Buyurtma" onClose={onClose}>
      <DataState isLoading={q.isLoading} isError={q.isError}>
        {o && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">{o.client_name}</span>
              <span className={STATUS_CLASS[o.status]}>{o.status_display}</span>
            </div>
            <div className="text-xs text-gray-500">
              {o.number} · {dateShort(o.date)} · zakaz: {o.taken_by_name}
              {o.assigned_to_name ? ` · yetkazuvchi: ${o.assigned_to_name}` : ''}
            </div>

            <table className="w-full text-xs">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="py-1">Tovar</th>
                  <th className="py-1 text-right">Buyurtma</th>
                  <th className="py-1 text-right">Yetkazildi</th>
                  <th className="py-1 text-right">Narx</th>
                  <th className="py-1 text-right">Summa</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="py-1">{it.product_name}</td>
                    <td className="py-1 text-right">{it.quantity}</td>
                    <td className="py-1 text-right">{it.delivered_quantity}</td>
                    <td className="py-1 text-right">{money(it.price)}</td>
                    <td className="py-1 text-right">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between font-semibold">
              <span>Jami</span>
              <span>{money(o.total_amount)}</span>
            </div>

            {o.note && <p className="text-gray-500">Izoh: {o.note}</p>}
            {o.cancel_reason && (
              <p className="text-danger">Bekor sababi: {o.cancel_reason}</p>
            )}

            {err && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-danger">
                {extractApiError(err)}
              </p>
            )}

            {canApprove && (
              <button
                className="btn-brand w-full"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                Tasdiqlash
              </button>
            )}
            {canCancel && (
              <div className="flex gap-2">
                <input
                  className="field"
                  placeholder="Bekor sababi"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="btn bg-danger px-3 text-white"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Bekor qilish
                </button>
              </div>
            )}
          </div>
        )}
      </DataState>
    </Modal>
  );
}

function BuildLoadingTab(): ReactElement {
  const qc = useQueryClient();
  const [distributor, setDistributor] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const orders = useQuery({
    queryKey: ['orders', 'for-loading'],
    queryFn: () => ordersApi.forLoading(),
  });
  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: () => authApi.distributors(),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 100 }),
  });

  const build = useMutation({
    mutationFn: () =>
      ordersApi.buildLoading({
        distributor,
        warehouse,
        order_ids: [...picked],
      }),
    onSuccess: () => {
      setPicked(new Set());
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['loadings'] });
    },
  });

  const rows = orders.data ?? [];

  function toggle(id: string): void {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
        <select
          className="field min-w-[180px]"
          value={distributor}
          onChange={(e) => setDistributor(e.target.value)}
        >
          <option value="">— tarqatuvchi —</option>
          {distributors.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
        <select
          className="field min-w-[160px]"
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
        >
          <option value="">— ombor —</option>
          {warehouses.data?.results.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button
          className="btn-brand px-4"
          disabled={
            !distributor || !warehouse || picked.size === 0 || build.isPending
          }
          onClick={() => build.mutate()}
        >
          {build.isPending
            ? 'Yig‘ilmoqda…'
            : `Yuklama yig‘ish (${picked.size})`}
        </button>
      </div>

      {build.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(build.error)}
        </p>
      )}
      {build.isSuccess && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Yuklama yig‘ildi — «Ombor → Yuklamalar» da yuboring.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={orders.isLoading}
          isError={orders.isError}
          isEmpty={!orders.isLoading && rows.length === 0}
          emptyText="Tasdiqlangan buyurtma yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3"> </th>
                <th className="p-3">Raqam</th>
                <th className="p-3">Mijoz</th>
                <th className="p-3">Zakaz oldi</th>
                <th className="p-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o: Order) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={picked.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">{o.number}</td>
                  <td className="p-3 font-medium">{o.client_name}</td>
                  <td className="p-3">{o.taken_by_name}</td>
                  <td className="p-3 text-right">{money(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}
