import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

import { PdfButtons } from './PdfButtons';
import { PurchaseForm } from './PurchaseForm';

export function PurchasesTab(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite =
    role === 'WAREHOUSE' || role === 'MANAGER' || role === 'SUPER_ADMIN';

  const [creating, setCreating] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ['purchases'],
    queryFn: () => warehouseApi.purchases({ page_size: 30, ordering: '-created_at' }),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => warehouseApi.confirmPurchase(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  const rows = query.data?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canWrite && (
          <button className="btn-brand px-4" onClick={() => setCreating(true)}>
            + Tovar qabuli
          </button>
        )}
      </div>

      {confirm.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(confirm.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          isEmpty={!query.isLoading && rows.length === 0}
          emptyText="Qabul yo'q"
        >
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
              <tr>
                <th className="p-3">Raqam</th>
                <th className="p-3">Yetkazib beruvchi</th>
                <th className="p-3">Ombor</th>
                <th className="p-3">Sana</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Holat</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="p-3 font-mono text-xs">{p.number}</td>
                  <td className="p-3">{p.supplier_name}</td>
                  <td className="p-3">{p.warehouse_name}</td>
                  <td className="p-3">{dateShort(p.date)}</td>
                  <td className="p-3 text-right">{money(p.total_amount)}</td>
                  <td className="p-3">
                    {p.status === 'CONFIRMED' ? (
                      <span className="text-success">{p.status_display}</span>
                    ) : (
                      <span className="text-pending">{p.status_display}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {canWrite && p.status === 'DRAFT' && (
                        <button
                          className="btn-brand px-3 py-1 text-xs"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(p.id)}
                        >
                          Tasdiqlash
                        </button>
                      )}
                      <PdfButtons
                        fetchPdf={(stamp) => warehouseApi.purchasePdf(p.id, stamp)}
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
        title="Yangi tovar qabuli"
        size="xl"
        onClose={() => setCreating(false)}
      >
        <PurchaseForm onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
