import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheckBig } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { ocrApi, type ScanLine } from '@/shared/api/ocr';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';

const MATCH_CLASS: Record<string, string> = {
  EXACT: 'text-success',
  FUZZY: 'text-pending',
  NEW: 'text-danger',
  UNMATCHED: 'text-danger',
};

export function ScanReview({
  scanId,
  onClose,
}: {
  scanId: string;
  onClose: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const scan = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => ocrApi.get(scanId),
    refetchInterval: (q) =>
      q.state.data?.status === 'PROCESSING' ? 2000 : false,
  });
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => catalogApi.products({ page_size: 500, is_active: true }),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => warehouseApi.suppliers({ page_size: 200 }),
  });

  const [zoom, setZoom] = useState<boolean>(false);

  const updateLine = useMutation({
    mutationFn: (v: { lineId: string; body: Record<string, string> }) =>
      ocrApi.updateLine(scanId, v.lineId, v.body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scan', scanId] }),
  });
  const updateHeader = useMutation({
    mutationFn: (body: Record<string, unknown>) => ocrApi.updateHeader(scanId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scan', scanId] }),
  });
  const confirm = useMutation({
    mutationFn: () => ocrApi.confirm(scanId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scans'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
  });
  const reprocess = useMutation({
    mutationFn: () => ocrApi.reprocess(scanId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scan', scanId] }),
  });

  const d = scan.data;
  const img = d?.pages[0]?.processed_image || d?.pages[0]?.image;

  return (
    <Modal open title="Naklitni tekshirish" onClose={onClose}>
      <div className="space-y-4">
        <DataState isLoading={scan.isLoading} isError={scan.isError}>
          {d && (
            <>
              {d.status === 'FAILED' && (
                <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
                  OCR xatosi: {d.error_message}
                  <button
                    className="ml-2 underline"
                    onClick={() => reprocess.mutate()}
                  >
                    Qayta urinish
                  </button>
                </div>
              )}

              {/* rasm */}
              {img && (
                <button
                  className="w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                  onClick={() => setZoom(true)}
                >
                  <img src={img} alt="naklit" className="max-h-64 w-full object-contain" />
                </button>
              )}

              {/* sarlavha */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="space-y-1">
                  <span className="text-xs text-gray-500">Yetkazib beruvchi</span>
                  <select
                    className="field"
                    value={d.supplier ?? ''}
                    onChange={(e) =>
                      updateHeader.mutate({ supplier: e.target.value || null })
                    }
                  >
                    <option value="">— tanlang —</option>
                    {suppliers.data?.results.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {d.detected_supplier_name && (
                    <span className="text-xs text-gray-400">
                      AI: {d.detected_supplier_name}
                    </span>
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-500">Nakladnoy raqami</span>
                  <input
                    className="field"
                    defaultValue={d.detected_invoice_number}
                    onBlur={(e) =>
                      updateHeader.mutate({ detected_invoice_number: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Provayder: {d.provider} · ishonch {d.confidence}</span>
                <span>${d.cost_usd} · {d.processing_time_ms} ms</span>
              </div>

              {/* qatorlar */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="p-2">Naklitdagi nom</th>
                      <th className="p-2">Mahsulot</th>
                      <th className="p-2 w-20">Soni</th>
                      <th className="p-2 w-28">Narx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((ln) => (
                      <LineRow
                        key={ln.id}
                        line={ln}
                        products={products.data?.results ?? []}
                        onChange={(body) =>
                          updateLine.mutate({ lineId: ln.id, body })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {confirm.isError && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {extractApiError(confirm.error)}
                </p>
              )}

              {d.status === 'NEEDS_REVIEW' && (
                <div className="flex gap-2">
                  <button
                    className="btn flex-1 text-danger"
                    onClick={() => {
                      void ocrApi.cancel(scanId).finally(onClose);
                    }}
                  >
                    Bekor / qo‘lda kiritish
                  </button>
                  <button
                    className="btn-brand flex flex-1 items-center justify-center gap-1.5"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate()}
                  >
                    Tasdiqlash <ArrowRight size={15} aria-hidden /> kirim
                  </button>
                </div>
              )}
              {d.status === 'CONFIRMED' && (
                <p className="flex items-center justify-center gap-1.5 text-center text-sm text-success">
                  <CircleCheckBig size={15} aria-hidden /> Tasdiqlangan · Purchase yaratildi
                </p>
              )}
            </>
          )}
        </DataState>

        {zoom && img && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setZoom(false)}
          >
            <img src={img} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>
    </Modal>
  );
}

function LineRow({
  line,
  products,
  onChange,
}: {
  line: ScanLine;
  products: Array<{ id: string; name: string; sku: string }>;
  onChange: (body: Record<string, string>) => void;
}): ReactElement {
  const cell = line.low_confidence ? 'bg-pending/10' : '';
  return (
    <tr className={`border-b border-gray-100 dark:border-gray-800 ${cell}`}>
      <td className="p-2">
        {line.raw_name}
        <span className={`ml-1 text-xs ${MATCH_CLASS[line.match_status] ?? ''}`}>
          ({line.match_status_display}
          {line.match_confidence ? ` ${line.match_confidence}%` : ''})
        </span>
      </td>
      <td className="p-2">
        <select
          className="field h-9 text-xs"
          value={line.final_product ?? ''}
          onChange={(e) => onChange({ final_product: e.target.value })}
        >
          <option value="">— tanlang —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <input
          className="field h-9 text-xs"
          type="number"
          step="0.001"
          defaultValue={line.final_quantity ?? line.raw_quantity}
          onBlur={(e) => onChange({ final_quantity: e.target.value })}
        />
      </td>
      <td className="p-2">
        <input
          className="field h-9 text-xs"
          type="number"
          step="0.01"
          defaultValue={line.final_price ?? line.raw_price}
          onBlur={(e) => onChange({ final_price: e.target.value })}
        />
        {line.raw_amount && (
          <span className="block text-[10px] text-gray-400">
            {money(line.raw_amount)}
          </span>
        )}
      </td>
    </tr>
  );
}
