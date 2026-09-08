import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, FileText, TriangleAlert } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { extractApiError } from '@/shared/api/client';
import { ocrApi } from '@/shared/api/ocr';
import { warehouseApi } from '@/shared/api/warehouse';
import { DataState } from '@/shared/components/DataState';

export function ScanInvoicePage(): ReactElement {
  const navigate = useNavigate();
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 50 }),
  });

  const [warehouse, setWarehouse] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('warehouse', warehouse);
      files.forEach((f) => form.append('images', f));
      return ocrApi.upload(form);
    },
  });

  if (upload.isSuccess) {
    const s = upload.data;
    return (
      <div className="space-y-4 py-10 text-center">
        {s.status === 'FAILED' ? (
          <TriangleAlert size={48} className="mx-auto text-danger" aria-hidden />
        ) : (
          <FileText size={48} className="mx-auto text-brand" aria-hidden />
        )}
        <h1 className="text-xl font-bold">
          {s.status === 'FAILED' ? 'O‘qib bo‘lmadi' : 'Naklit yuklandi'}
        </h1>
        {s.status === 'FAILED' ? (
          <p className="text-sm text-gray-500">{s.error_message}</p>
        ) : (
          <p className="text-sm text-gray-500">
            {s.line_count} ta qator aniqlandi. Ombor menejeri tekshirib
            tasdiqlaydi.
          </p>
        )}
        <div className="flex justify-center gap-2">
          <button className="btn px-5" onClick={() => navigate('/m')}>
            Bosh sahifa
          </button>
          <button
            className="btn-brand px-5"
            onClick={() => {
              upload.reset();
              setFiles([]);
            }}
          >
            Yana skanerlash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Naklit skanerlash</h1>
      <p className="text-sm text-gray-500">
        Naklitni yaxshi yorug'likda, to'g'ri burchakdan suratga oling.
      </p>

      <DataState isLoading={warehouses.isLoading} isError={warehouses.isError}>
        <select
          className="field"
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
        >
          <option value="">Ombor tanlang…</option>
          {warehouses.data?.results.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </DataState>

      <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-500 dark:border-gray-700">
        <Camera size={32} aria-hidden />
        <span className="mt-1 text-sm">
          {files.length > 0 ? `${files.length} ta rasm tanlandi` : 'Rasmga olish'}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      {upload.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(upload.error)}
        </p>
      )}

      <button
        className="btn-brand w-full"
        disabled={!warehouse || files.length === 0 || upload.isPending}
        onClick={() => upload.mutate()}
      >
        {upload.isPending ? 'Yuklanmoqda va o‘qilmoqda…' : 'Yuklash'}
      </button>
    </div>
  );
}
