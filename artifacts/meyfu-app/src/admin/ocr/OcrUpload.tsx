import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { ocrApi } from '@/shared/api/ocr';
import { warehouseApi } from '@/shared/api/warehouse';
import { Modal } from '@/shared/components/Modal';

export function OcrUpload({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (id: string) => void;
}): ReactElement {
  const qc = useQueryClient();
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 100 }),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => warehouseApi.suppliers({ page_size: 200 }),
  });

  const [warehouse, setWarehouse] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);

  const mutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('warehouse', warehouse);
      if (supplier) form.append('supplier', supplier);
      files.forEach((f) => form.append('images', f));
      return ocrApi.upload(form);
    },
    onSuccess: (scan) => {
      void qc.invalidateQueries({ queryKey: ['scans'] });
      setFiles([]);
      onUploaded(scan.id);
    },
  });

  return (
    <Modal open={open} title="Naklit skanerlash" onClose={onClose}>
      <div className="space-y-3">
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
          <span className="text-sm font-medium">Yetkazib beruvchi (ixtiyoriy)</span>
          <select
            className="field"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">AI aniqlaydi</option>
            {suppliers.data?.results.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Rasm(lar) *</span>
          <input
            className="field py-2"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <span className="text-xs text-gray-500">{files.length} ta rasm</span>
          )}
        </label>

        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}

        <button
          className="btn-brand w-full"
          disabled={!warehouse || files.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Yuklanmoqda va o‘qilmoqda…' : 'Yuklash va o‘qish'}
        </button>
      </div>
    </Modal>
  );
}
