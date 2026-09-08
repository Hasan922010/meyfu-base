import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CircleCheckBig,
  Info,
  type LucideIcon,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { ocrApi } from '@/shared/api/ocr';
import { DataState } from '@/shared/components/DataState';
import { dateShort } from '@/shared/lib/format';

import { OcrUpload } from './OcrUpload';
import { ScanReview } from './ScanReview';

const STATUS_CLASS: Record<string, string> = {
  PROCESSING: 'text-brand',
  NEEDS_REVIEW: 'text-pending',
  CONFIRMED: 'text-success',
  FAILED: 'text-danger',
  CANCELLED: 'text-gray-400',
};

const DECISION: Record<string, { text: string; cls: string; Icon: LucideIcon }> = {
  OCR_WORKING: { text: 'OCR foyda bermoqda', cls: 'text-success', Icon: CircleCheckBig },
  PREFER_MANUAL: {
    text: "OCR aniqligi past — qo'lda kiritish afzal",
    cls: 'text-danger',
    Icon: TriangleAlert,
  },
  INSUFFICIENT_DATA: {
    text: "Yetarli ma'lumot yo'q (20 ta naklit kerak)",
    cls: 'text-gray-500',
    Icon: Info,
  },
};

export function OcrPage(): ReactElement {
  const [tab, setTab] = useState<'queue' | 'metrics'>('queue');
  const [uploadOpen, setUploadOpen] = useState<boolean>(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const scans = useQuery({
    queryKey: ['scans'],
    queryFn: () => ocrApi.list({ page_size: 40, ordering: '-created_at' }),
    refetchInterval: 10_000,
  });
  const metrics = useQuery({
    queryKey: ['ocr-metrics'],
    queryFn: () => ocrApi.metrics(30),
    enabled: tab === 'metrics',
  });

  const rows = scans.data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kirim / Naklit skanerlash</h1>
        <button
          className="btn-brand flex items-center gap-1.5 px-4"
          onClick={() => setUploadOpen(true)}
        >
          <ScanLine size={16} aria-hidden /> Naklit skanerlash
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {[
          { id: 'queue', l: 'Navbat' },
          { id: 'metrics', l: 'Metrikalar' },
        ].map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand text-brand' : 'text-gray-500'
            }`}
            onClick={() => setTab(t.id as 'queue' | 'metrics')}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
          <DataState
            isLoading={scans.isLoading}
            isError={scans.isError}
            isEmpty={!scans.isLoading && rows.length === 0}
            emptyText="Skan yo'q"
          >
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Raqam</th>
                  <th className="p-3">Yetkazuvchi</th>
                  <th className="p-3 text-right">Qatorlar</th>
                  <th className="p-3 text-right">$</th>
                  <th className="p-3">Holat</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    onClick={() => setReviewId(s.id)}
                  >
                    <td className="p-3">{dateShort(s.created_at)}</td>
                    <td className="p-3 font-mono text-xs">
                      {s.detected_invoice_number || '—'}
                    </td>
                    <td className="p-3">
                      {s.detected_supplier_name || s.uploaded_by_name}
                    </td>
                    <td className="p-3 text-right">{s.line_count}</td>
                    <td className="p-3 text-right text-xs text-gray-400">
                      {s.cost_usd}
                    </td>
                    <td className={`p-3 ${STATUS_CLASS[s.status] ?? ''}`}>
                      {s.status_display}
                    </td>
                    <td className="p-3 text-right text-brand">
                      {s.status === 'NEEDS_REVIEW' && (
                        <span className="inline-flex items-center gap-1">
                          Tekshirish <ArrowRight size={14} aria-hidden />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </div>
      )}

      {tab === 'metrics' && (
        <DataState isLoading={metrics.isLoading} isError={metrics.isError}>
          {metrics.data && (
            <div className="space-y-4">
              {(() => {
                const d = DECISION[metrics.data.decision];
                if (!d) return null;
                return (
                  <div
                    className={`flex items-center justify-center gap-2 rounded-xl bg-white p-4 text-center font-semibold shadow-sm dark:bg-gray-900 ${d.cls}`}
                  >
                    <d.Icon size={18} aria-hidden />
                    {d.text}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Qator aniqligi" value={`${metrics.data.line_accuracy_pct}%`} />
                <Kpi label="Tuzatish darajasi" value={`${metrics.data.correction_rate_pct}%`} />
                <Kpi label="Qo'lga qaytish" value={`${metrics.data.manual_fallback_pct}%`} />
                <Kpi label="Tasdiqlashgacha" value={`${metrics.data.avg_time_to_confirm_sec} s`} />
                <Kpi label="Skanlar" value={String(metrics.data.scans_total)} />
                <Kpi label="Tasdiqlangan" value={String(metrics.data.scans_confirmed)} />
                <Kpi label="Xato" value={String(metrics.data.scans_failed)} />
                <Kpi
                  label="O'rtacha $/skan"
                  value={`$${metrics.data.avg_cost_per_scan_usd}`}
                />
              </div>

              <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
                <div className="mb-2 font-semibold">API xarajati (limit)</div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bugun</span>
                  <span>
                    ${metrics.data.cost_limit.daily_used_usd} / $
                    {metrics.data.cost_limit.daily_limit_usd}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Oy</span>
                  <span>
                    ${metrics.data.cost_limit.monthly_used_usd} / $
                    {metrics.data.cost_limit.monthly_limit_usd}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
                <div className="mb-2 font-semibold">Moslik taqsimoti</div>
                {Object.entries(metrics.data.match_breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DataState>
      )}

      <OcrUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(id) => {
          setUploadOpen(false);
          setReviewId(id);
        }}
      />
      {reviewId && (
        <ScanReview scanId={reviewId} onClose={() => setReviewId(null)} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
