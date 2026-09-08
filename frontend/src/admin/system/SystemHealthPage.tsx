import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { systemApi, type IntegrityMismatch } from '@/shared/api/system';
import { DataState } from '@/shared/components/DataState';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

function ago(iso: string | null): string {
  if (!iso) return "hali yo'q";
  const h = (Date.now() - new Date(iso).getTime()) / 3.6e6;
  if (h < 1) return `${Math.round(h * 60)} daqiqa oldin`;
  if (h < 24) return `${Math.round(h)} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}

type Tone = 'ok' | 'warn' | 'bad' | 'unknown';

const TONE_STYLE: Record<Tone, string> = {
  ok: 'text-success',
  warn: 'text-pending',
  bad: 'text-danger',
  unknown: 'text-gray-400',
};

function ToneIcon({ tone }: { tone: Tone }): ReactElement {
  const cls = `${TONE_STYLE[tone]} shrink-0`;
  if (tone === 'ok') return <CheckCircle2 size={18} className={cls} aria-hidden />;
  if (tone === 'warn') return <AlertTriangle size={18} className={cls} aria-hidden />;
  if (tone === 'bad') return <XCircle size={18} className={cls} aria-hidden />;
  return <HelpCircle size={18} className={cls} aria-hidden />;
}

function StatusCard({
  title,
  tone,
  lines,
}: {
  title: string;
  tone: Tone;
  lines: string[];
}): ReactElement {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <ToneIcon tone={tone} />
        <span className="font-semibold">{title}</span>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-gray-500">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export function SystemHealthPage(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canFix = role === 'SUPER_ADMIN';

  const status = useQuery({
    queryKey: ['system-status'],
    queryFn: () => systemApi.status(),
    refetchInterval: 30_000,
  });

  const check = useMutation({
    mutationFn: () => systemApi.integrityCheck(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['system-status'] }),
  });
  const fix = useMutation({
    mutationFn: () => systemApi.integrityFix(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['system-status'] });
      check.reset();
    },
  });

  const s = status.data;
  const liveMismatches =
    check.data?.mismatches ?? s?.integrity.mismatches ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tizim salomatligi</h1>
        <button
          className="btn flex items-center gap-1.5 px-3"
          onClick={() => void status.refetch()}
        >
          <RefreshCw size={16} aria-hidden /> Yangilash
        </button>
      </div>

      <DataState isLoading={status.isLoading} isError={status.isError}>
        {s && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatusCard
                title="Xizmatlar"
                tone={
                  s.health.healthy
                    ? s.health.checks.disk.ok && s.health.checks.celery.ok !== false
                      ? 'ok'
                      : 'warn'
                    : 'bad'
                }
                lines={[
                  `Baza: ${s.health.checks.db ? 'ishlayapti' : 'javob bermayapti'}`,
                  `Redis: ${s.health.checks.redis ? 'ishlayapti' : 'javob bermayapti'}`,
                  `Celery: ${
                    s.health.checks.celery.ok == null
                      ? 'noma’lum'
                      : s.health.checks.celery.ok
                        ? `${s.health.checks.celery.workers} ishchi`
                        : 'ishchi yo’q'
                  }`,
                  `Disk: ${
                    s.health.checks.disk.free_percent == null
                      ? 'noma’lum'
                      : `${s.health.checks.disk.free_percent}% bo’sh (${s.health.checks.disk.free_gb} GB)`
                  }`,
                  `Navbat: ${s.health.queue_length ?? '—'}`,
                ]}
              />

              <StatusCard
                title="Ma'lumot butunligi"
                tone={
                  s.integrity.ok == null
                    ? 'unknown'
                    : s.integrity.ok
                      ? 'ok'
                      : 'bad'
                }
                lines={[
                  s.integrity.ran_at
                    ? `Oxirgi tekshiruv: ${ago(s.integrity.ran_at)}`
                    : 'Hali tekshirilmagan',
                  s.integrity.ok == null
                    ? 'Natija yo’q'
                    : s.integrity.ok
                      ? 'Barcha balans jurnalga mos'
                      : `${s.integrity.mismatch_count} ta farq`,
                ]}
              />

              <StatusCard
                title="Zaxira nusxa (backup)"
                tone={
                  s.backup.status === 'ok'
                    ? 'ok'
                    : s.backup.status === 'stale'
                      ? 'warn'
                      : 'unknown'
                }
                lines={
                  s.backup.status === 'unknown'
                    ? ['Backup fayli topilmadi']
                    : [
                        `Oxirgi: ${ago(s.backup.last_at)} (${s.backup.age_hours} soat)`,
                        `Hajmi: ${s.backup.size_mb} MB · jami ${s.backup.count} ta`,
                      ]
                }
              />

              <StatusCard
                title="Sinxronizatsiya"
                tone={s.sync.conflicts > 0 ? 'bad' : 'ok'}
                lines={[
                  `Ziddiyat (CONFLICT): ${s.sync.conflicts}`,
                  `Belgilangan (FLAGGED): ${s.sync.flagged}`,
                  `Serverga tushmagan: ${s.sync.unsynced}`,
                ]}
              />

              <StatusCard
                title="OCR (naklit skani)"
                tone={
                  !s.ocr.configured
                    ? 'unknown'
                    : s.ocr.failed_7d > 0
                      ? 'warn'
                      : 'ok'
                }
                lines={[
                  s.ocr.configured
                    ? 'Claude vision ulangan'
                    : 'API kaliti yo’q — mock rejim',
                  `Tekshirish kutmoqda: ${s.ocr.needs_review}`,
                  `7 kunda xato: ${s.ocr.failed_7d}`,
                ]}
              />

              <StatusCard
                title="Xatoliklar monitoringi (Sentry)"
                tone={s.sentry_enabled ? 'ok' : 'unknown'}
                lines={[
                  s.sentry_enabled
                    ? 'Sentry yoqilgan'
                    : 'Sentry sozlanmagan (DSN yo’q)',
                ]}
              />
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Butunlik tekshiruvi</h2>
                <div className="flex gap-2">
                  <button
                    className="btn px-3"
                    disabled={check.isPending}
                    onClick={() => check.mutate()}
                  >
                    {check.isPending ? 'Tekshirilmoqda…' : 'Hozir tekshirish'}
                  </button>
                  {canFix && liveMismatches.length > 0 && (
                    <button
                      className="btn-brand px-3"
                      disabled={fix.isPending}
                      onClick={() => fix.mutate()}
                    >
                      {fix.isPending ? 'Tuzatilmoqda…' : 'Farqlarni tuzatish'}
                    </button>
                  )}
                </div>
              </div>

              {(check.isError || fix.isError) && (
                <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {extractApiError(check.error ?? fix.error)}
                </p>
              )}

              {check.data?.ok || (check.isSuccess && liveMismatches.length === 0) ? (
                <p className="mt-3 text-sm text-success">
                  ✓ Barcha balans jurnal yig'indisiga mos.
                </p>
              ) : liveMismatches.length > 0 ? (
                <MismatchTable rows={liveMismatches} />
              ) : (
                <p className="mt-3 text-sm text-gray-400">
                  «Hozir tekshirish» tugmasini bosing yoki tungi avtomatik
                  natijani kuting.
                </p>
              )}
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}

function MismatchTable({ rows }: { rows: IntegrityMismatch[] }): ReactElement {
  const isMoney = (k: string): boolean =>
    k === 'wallet' || k === 'cash_account' || k === 'order_total';
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800">
          <tr>
            <th className="py-2 pr-3">Obyekt</th>
            <th className="py-2 pr-3 text-right">Saqlangan</th>
            <th className="py-2 pr-3 text-right">Jurnal</th>
            <th className="py-2 text-right">Farq</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-gray-100 last:border-0 dark:border-gray-800"
            >
              <td className="py-2 pr-3">{r.label}</td>
              <td className="py-2 pr-3 text-right">
                {isMoney(r.kind) ? money(r.stored) : r.stored}
              </td>
              <td className="py-2 pr-3 text-right">
                {isMoney(r.kind) ? money(r.ledger) : r.ledger}
              </td>
              <td className="py-2 text-right font-medium text-danger">
                {isMoney(r.kind) ? money(r.diff) : r.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
