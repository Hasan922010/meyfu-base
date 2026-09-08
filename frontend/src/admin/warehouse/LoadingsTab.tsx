import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

import { LoadingForm } from './LoadingForm';
import { PdfButtons } from './PdfButtons';

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'text-pending',
  SENT: 'text-brand',
  CONFIRMED: 'text-success',
  CLOSED: 'text-gray-500',
};

export function LoadingsTab(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite =
    role === 'WAREHOUSE' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['loadings'],
    queryFn: () => warehouseApi.loadings({ page_size: 30, ordering: '-created_at' }),
  });

  const send = useMutation({
    mutationFn: (id: string) => warehouseApi.sendLoading(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['loadings'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Yuklama
          </button>
        )}
      </div>

      {send.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(send.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Yuklama yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Tarqatuvchi</th>
                <th className="p-3">Sana</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Holat</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-mono text-xs">{l.number}</td>
                  <td className="p-3">{l.distributor_name}</td>
                  <td className="p-3">{dateShort(l.date)}</td>
                  <td className="p-3 text-right">{money(l.total_amount)}</td>
                  <td className={`p-3 font-medium ${STATUS_CLASS[l.status] ?? ''}`}>
                    {l.status_display}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {canWrite && l.status === 'DRAFT' && (
                        <button
                          className="btn-brand px-3 py-1 text-xs"
                          disabled={send.isPending}
                          onClick={() => send.mutate(l.id)}
                        >
                          Yuborish
                        </button>
                      )}
                      {l.status === 'SENT' && (
                        <span className="text-xs text-gray-400">
                          tasdiqlash kutilmoqda
                        </span>
                      )}
                      <PdfButtons
                        fetchPdf={(stamp) => warehouseApi.loadingPdf(l.id, stamp)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={creating}
        title="Yangi yuklama"
        size="xl"
        onClose={() => setCreating(false)}
      >
        <LoadingForm onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
