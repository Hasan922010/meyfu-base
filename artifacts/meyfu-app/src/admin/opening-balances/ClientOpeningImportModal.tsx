import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import {
  clientsApi,
  type ClientOpeningFieldKey,
  type ClientOpeningImportReport,
  type ClientOpeningInspect,
} from '@/shared/api/clients';
import { authApi } from '@/shared/api/users';
import { Modal } from '@/shared/components/Modal';
import { money } from '@/shared/lib/format';
import { ROLE_LABELS } from '@/shared/lib/labels';
import { useToast } from '@/shared/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_AND_DEBT: 'Yangi mijoz + qarz',
  CREATE_CLIENT: 'Yangi mijoz',
  ADD_DEBT: "Qarz qo'shiladi",
  SKIP: "O'zgarishsiz",
  ERROR: 'Xato',
};

async function downloadTemplate(): Promise<void> {
  const blob = await clientsApi.openingImportTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mijoz-boshlangich-qarz-shablon.xlsx';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ClientOpeningImportModal({ open, onClose, onDone }: Props): ReactElement {
  const qc = useQueryClient();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [inspectData, setInspectData] = useState<ClientOpeningInspect | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ClientOpeningFieldKey, number | null>>>({});
  const [defaultStaff, setDefaultStaff] = useState<string>('');
  const [autoCreateMissing, setAutoCreateMissing] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [preview, setPreview] = useState<ClientOpeningImportReport | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff', 'active'],
    queryFn: authApi.staff,
    enabled: open,
  });

  const inspectMut = useMutation({
    mutationFn: (f: File) => clientsApi.openingImportInspect(f),
    onSuccess: (data) => {
      setInspectData(data);
      setMapping(data.auto_mapping ?? {});
      setPreview(null);
    },
  });

  const checkMut = useMutation({
    mutationFn: (f: File) =>
      clientsApi.openingImportApply(f, {
        mapping,
        ...(defaultStaff ? { default_assigned_to: defaultStaff } : {}),
        auto_create_missing: autoCreateMissing,
        ...(note.trim() ? { note: note.trim() } : {}),
        dry_run: true,
      }),
    onSuccess: setPreview,
  });

  const applyMut = useMutation({
    mutationFn: (f: File) =>
      clientsApi.openingImportApply(f, {
        mapping,
        ...(defaultStaff ? { default_assigned_to: defaultStaff } : {}),
        auto_create_missing: autoCreateMissing,
        ...(note.trim() ? { note: note.trim() } : {}),
        dry_run: false,
      }),
    onSuccess: (report) => {
      setPreview(report);
      if (report.errors === 0) {
        toast.push({
          kind: 'success',
          title: `${report.created_clients} ta yangi mijoz, ${report.debts_applied} ta qarz yuklandi`,
        });
        void qc.invalidateQueries({ queryKey: ['opening-sheet'] });
        void qc.invalidateQueries({ queryKey: ['debts'] });
        void qc.invalidateQueries({ queryKey: ['clients'] });
        void qc.invalidateQueries({ queryKey: ['clients-all'] });
        resetState();
        onDone();
      }
    },
  });

  const duplicateColIndices = useMemo(() => {
    const counts = new Map<number, number>();
    for (const val of Object.values(mapping)) {
      if (typeof val === 'number') {
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([idx]) => idx));
  }, [mapping]);

  const hasRequiredMapping =
    typeof mapping.name === 'number' &&
    typeof mapping.amount === 'number' &&
    duplicateColIndices.size === 0;

  const activeError = inspectMut.error ?? checkMut.error ?? applyMut.error;

  function resetState(): void {
    setFile(null);
    setInspectData(null);
    setMapping({});
    setPreview(null);
    setDefaultStaff('');
    setAutoCreateMissing(true);
    setNote('');
  }

  function handleClose(): void {
    resetState();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Mijozlar boshlang'ich qarzini Excel'dan import qilish"
      size="xl"
      onClose={handleClose}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Istalgan Excel (.xlsx) faylni yuklab, ustunlarni tizim maydonlariga moslang.
            Bazada yo‘q mijozlar avtomatik kiritilib, mas’ul xodimga biriktiriladi.
          </p>
          <button
            type="button"
            className="btn flex items-center gap-1.5 px-3 text-xs"
            onClick={() => {
              void downloadTemplate().catch((err) => {
                toast.push({ kind: 'danger', title: extractApiError(err) });
              });
            }}
          >
            <Download size={14} aria-hidden /> Shablonni yuklab olish
          </button>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-4 text-gray-500 hover:border-brand dark:border-gray-700">
          <FileSpreadsheet size={18} aria-hidden />
          <span>{file ? `${file.name}` : 'Excel faylni tanlang (.xlsx)'}</span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.currentTarget.value = '';
              setFile(f);
              setInspectData(null);
              setPreview(null);
              if (f) inspectMut.mutate(f);
            }}
          />
        </label>

        {inspectMut.isPending && <p className="text-gray-500">Excel ustunlari o‘qilmoqda…</p>}
        {activeError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-danger">
            {extractApiError(activeError)}
          </p>
        )}

        {inspectData && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium dark:border-gray-800 dark:bg-gray-800">
                <span>Ustunlarni moslashtirish ({inspectData.total_rows} ta qator topildi)</span>
                {duplicateColIndices.size > 0 && (
                  <span className="text-danger">Bitta ustunni ikkita maydonga tanlamang</span>
                )}
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {inspectData.target_fields.map((tf) => {
                  const selectedIdx = mapping[tf.key];
                  const isDup =
                    typeof selectedIdx === 'number' && duplicateColIndices.has(selectedIdx);
                  const sampleVal =
                    typeof selectedIdx === 'number'
                      ? inspectData.sample_rows[0]?.[selectedIdx] || '—'
                      : '—';

                  return (
                    <div
                      key={tf.key}
                      className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-12"
                    >
                      <div className="font-medium sm:col-span-4">
                        {tf.label}
                        {tf.required && <span className="text-danger"> *</span>}
                      </div>
                      <div className="sm:col-span-5">
                        <select
                          aria-label={tf.label}
                          className={`field ${isDup ? 'border-danger' : ''}`}
                          value={typeof selectedIdx === 'number' ? String(selectedIdx) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreview(null);
                            setMapping((prev) => ({
                              ...prev,
                              [tf.key]: val === '' ? null : Number(val),
                            }));
                          }}
                        >
                          <option value="">— Tanlanmagan —</option>
                          {inspectData.columns.map((col) => {
                            const firstCell = inspectData.sample_rows[0]?.[col.index];
                            return (
                              <option key={col.index} value={col.index}>
                                {col.letter}: {col.header}
                                {firstCell ? ` (${firstCell})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="truncate text-xs text-gray-500 sm:col-span-3">
                        Namuna: <span className="font-mono">{sampleVal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Standart mas’ul xodim (jadvalda bo‘sh bo‘lsa)
                </span>
                <select
                  aria-label="Standart mas'ul xodim"
                  className="field"
                  value={defaultStaff}
                  onChange={(e) => {
                    setDefaultStaff(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">— Tanlanmagan —</option>
                  {(staffQuery.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({ROLE_LABELS[u.role] ?? u.role})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Umumiy izoh (ixtiyoriy)
                </span>
                <input
                  className="field"
                  placeholder="Masalan: 2026 boshlang'ich qoldiq"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setPreview(null);
                  }}
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCreateMissing}
                onChange={(e) => {
                  setAutoCreateMissing(e.target.checked);
                  setPreview(null);
                }}
              />
              <span>Bazada yo‘q mijozlarni avtomatik yaratish</span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn px-4"
                disabled={!file || !hasRequiredMapping || checkMut.isPending}
                onClick={() => file && checkMut.mutate(file)}
              >
                {checkMut.isPending ? 'Tekshirilmoqda…' : 'Tekshirish'}
              </button>
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
            <div className="flex flex-wrap gap-3 text-xs font-medium">
              <span className="text-success">Yangi mijoz: {preview.created_clients}</span>
              <span className="text-gray-600 dark:text-gray-300">
                Mavjud mijoz: {preview.existing_clients}
              </span>
              <span className="text-brand">Qarz qo‘shiladi: {preview.debts_applied}</span>
              <span className="text-gray-500">O‘zgarishsiz: {preview.skipped}</span>
              <span className={preview.errors ? 'text-danger' : 'text-gray-500'}>
                Xato: {preview.errors}
              </span>
            </div>

            {preview.rows.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-left dark:bg-gray-800">
                    <tr>
                      <th className="p-2">Qator</th>
                      <th className="p-2">Mijoz</th>
                      <th className="p-2">Mas’ul xodim</th>
                      <th className="p-2 text-right">Joriy → Yangi</th>
                      <th className="p-2">Natija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2 font-medium">
                          <div>{r.client_name}</div>
                          {r.client_phone && (
                            <div className="text-[11px] font-normal text-gray-500">{r.client_phone}</div>
                          )}
                        </td>
                        <td className="p-2">{r.assigned_to_name || '—'}</td>
                        <td className="p-2 text-right">
                          {money(r.current_debt)} → {money(r.target_debt)}
                          {Number(r.delta) > 0 ? ` (+${money(r.delta)})` : ''}
                        </td>
                        <td className={`p-2 ${r.action === 'ERROR' ? 'text-danger' : ''}`}>
                          {ACTION_LABEL[r.action] ?? r.action}
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
                Xatolarni faylda yoki ustun mosligida tuzatib qayta tekshiring — xato bo‘lsa
                hech narsa yozilmaydi.
              </p>
            ) : (
              <button
                type="button"
                className="btn-brand w-full"
                disabled={
                  !file ||
                  applyMut.isPending ||
                  preview.created_clients + preview.debts_applied === 0
                }
                onClick={() => file && applyMut.mutate(file)}
              >
                {applyMut.isPending
                  ? 'Saqlanmoqda…'
                  : `Tasdiqlash va yuklash (${preview.created_clients} mijoz, ${preview.debts_applied} qarz)`}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
