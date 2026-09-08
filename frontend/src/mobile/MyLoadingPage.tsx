import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { dateShort, money, qty } from '@/shared/lib/format';

export function MyLoadingPage(): ReactElement {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['loadings', 'my-today'],
    queryFn: () => warehouseApi.myTodayLoadings(),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => warehouseApi.confirmLoading(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loadings', 'my-today'] });
      void qc.invalidateQueries({ queryKey: ['van-stock', 'my'] });
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Mening yuklamam</h1>

      {confirm.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(confirm.error)}
        </p>
      )}

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={!query.isLoading && rows.length === 0}
        emptyText="Bugun yuklama yo‘q"
      >
        <div className="space-y-4">
          {rows.map((l) => (
            <div
              key={l.id}
              className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs text-gray-500">{l.number}</div>
                  <div className="text-sm">{dateShort(l.date)}</div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    l.status === 'CONFIRMED' ? 'text-success' : 'text-brand'
                  }`}
                >
                  {l.status_display}
                </span>
              </div>

              <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
                {l.items.map((it) => (
                  <li key={it.id} className="flex justify-between py-1.5">
                    <span>{it.product_name}</span>
                    <span className="font-medium">{qty(it.quantity)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-sm text-gray-500">Jami</span>
                <span className="font-semibold">{money(l.total_amount)}</span>
              </div>

              {l.status === 'SENT' && (
                <button
                  className="btn-brand w-full"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(l.id)}
                >
                  Qabul qildim — tasdiqlash
                </button>
              )}
            </div>
          ))}
        </div>
      </DataState>
    </div>
  );
}
