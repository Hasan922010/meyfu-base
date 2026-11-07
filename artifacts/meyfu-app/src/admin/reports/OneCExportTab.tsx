import { useMutation } from '@tanstack/react-query';
import { FileCode, FileSpreadsheet } from 'lucide-react';
import type { ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { reportsAdvancedApi } from '@/shared/api/reportsAdvanced';
import { dateShort } from '@/shared/lib/format';

type Format = 'xml' | 'csv';

/** v5 C6: 1C uchun fayl eksporti — sotuvlar, qaytarishlar, qarz to'lovlari. */
export function OneCExportTab({
  range,
}: {
  range: { date_from: string; date_to: string };
}): ReactElement {
  const download = useMutation({
    mutationFn: async (fmt: Format) => {
      const blob = await reportsAdvancedApi.export1c({ ...range, fmt });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `1c-${range.date_from}-${range.date_to}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="space-y-4 rounded-xl bg-white p-5 text-sm shadow-sm dark:bg-gray-900">
      <div>
        <h2 className="font-semibold">1C uchun eksport</h2>
        <p className="mt-1 text-gray-500">
          {dateShort(range.date_from)} – {dateShort(range.date_to)} davridagi sotuvlar (qatorlari
          bilan), mijozdan qaytarishlar va qarz to‘lovlari. Bekor qilingan sotuvlar kirmaydi.
          Faylni 1C’da «Universal ma’lumot almashinuvi» yoki qayta ishlash orqali yuklang.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn flex items-center gap-1.5 px-4"
          disabled={download.isPending}
          onClick={() => download.mutate('xml')}
        >
          <FileCode size={16} aria-hidden /> XML yuklab olish
        </button>
        <button
          className="btn flex items-center gap-1.5 px-4"
          disabled={download.isPending}
          onClick={() => download.mutate('csv')}
        >
          <FileSpreadsheet size={16} aria-hidden /> CSV yuklab olish
        </button>
      </div>
      {download.isError && <p className="text-danger">{extractApiError(download.error)}</p>}
      <p className="text-xs text-gray-400">
        CSV: «;» bilan ajratilgan, UTF-8. Ustunlar: hujjat turi, raqam, sana, mijoz, INN,
        artikul, mahsulot, miqdor, narx, summa, to‘lov turi.
      </p>
    </div>
  );
}
