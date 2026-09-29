import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { catalogApi, type ProductImportReport } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Yangi',
  UPDATE: 'Yangilanadi',
  SKIP: "O'zgarishsiz",
  ERROR: 'Xato',
};

async function downloadTemplate(): Promise<void> {
  const blob = await catalogApi.importTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mahsulot-shablon.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** v5 B1: Excel'dan import — avval tekshirish (dry-run), keyin tasdiqlab yozish. */
export function ProductImport({ onDone }: { onDone: () => void }): ReactElement {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportReport | null>(null);

  const check = useMutation({
    mutationFn: (f: File) => catalogApi.importProducts(f, true),
    onSuccess: setPreview,
  });
  const apply = useMutation({
    mutationFn: (f: File) => catalogApi.importProducts(f, false),
    onSuccess: (report) => {
      setPreview(report);
      if (report.errors === 0) {
        void qc.invalidateQueries({ queryKey: ['products'] });
        onDone();
      }
    },
  });

  const error = check.error ?? apply.error;
  const changedRows = preview?.rows.filter((r) => r.action !== 'SKIP') ?? [];

  return (
    <div className="space-y-4 text-sm">
      <p className="text-gray-500">
        Birinchi qatorda ustun nomlari bo‘lsin: <b>artikul</b>, <b>nomi</b>, kategoriya, birlik,
        brend, shtrix-kod, tannarx, optom narx, chakana narx, minimal narx, qadoqdagi soni.
        Artikul bo‘yicha bor mahsulot yangilanadi, yo‘g‘i yaratiladi.
      </p>
      <button className="btn flex items-center gap-1.5 px-3" onClick={() => void downloadTemplate()}>
        <Download size={16} aria-hidden /> Shablonni yuklab olish
      </button>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-4 text-gray-500 dark:border-gray-700">
        <FileSpreadsheet size={18} aria-hidden />
        {file ? file.name : 'Excel faylni tanlang (.xlsx)'}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            if (f) check.mutate(f);
          }}
        />
      </label>

      {check.isPending && <p>Tekshirilmoqda…</p>}
      {error && <p className="text-danger">{extractApiError(error)}</p>}

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <span className="text-success">Yangi: {preview.created}</span>
            <span className="text-brand">Yangilanadi: {preview.updated}</span>
            <span className="text-gray-500">O‘zgarishsiz: {preview.unchanged}</span>
            <span className={preview.errors ? 'text-danger' : 'text-gray-500'}>
              Xato: {preview.errors}
            </span>
          </div>

          {changedRows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left dark:bg-gray-800">
                  <tr>
                    <th className="p-2">Qator</th>
                    <th className="p-2">Artikul</th>
                    <th className="p-2">Natija</th>
                  </tr>
                </thead>
                <tbody>
                  {changedRows.map((r) => (
                    <tr key={r.row} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-2">{r.row}</td>
                      <td className="p-2 font-mono">{r.sku || '—'}</td>
                      <td className={`p-2 ${r.action === 'ERROR' ? 'text-danger' : ''}`}>
                        {ACTION_LABEL[r.action]}
                        {r.errors.length > 0 && `: ${r.errors.join(' ')}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors > 0 ? (
            <p className="text-pending">
              Xatolarni faylda tuzatib, qayta yuklang — xato bo‘lsa hech narsa yozilmaydi.
            </p>
          ) : (
            <button
              className="btn-brand w-full"
              disabled={!file || apply.isPending || preview.created + preview.updated === 0}
              onClick={() => file && apply.mutate(file)}
            >
              {apply.isPending
                ? 'Yozilmoqda…'
                : `Tasdiqlash: ${preview.created + preview.updated} ta mahsulot`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
