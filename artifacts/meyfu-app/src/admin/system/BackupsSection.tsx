import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Download,
  HardDrive,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';

import { backupApi, type BackupItem } from '@/shared/api/backup';
import { extractApiError } from '@/shared/api/client';
import { Modal } from '@/shared/components/Modal';
import { useAuthStore } from '@/shared/store/authStore';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('uz-UZ')} ${d.toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return iso;
  }
}

function ago(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3.6e6;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} daqiqa oldin`;
  if (h < 24) return `${Math.round(h)} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}

export function BackupsSection(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [createOpen, setCreateOpen] = useState(false);
  const [createFormat, setCreateFormat] = useState<'auto' | 'sql' | 'json'>('auto');
  const [createNote, setCreateNote] = useState('');

  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [restoreConfirmChecked, setRestoreConfirmChecked] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const backups = useQuery({
    queryKey: ['system-backups'],
    queryFn: () => backupApi.list(),
  });

  const createMut = useMutation({
    mutationFn: () => backupApi.create({ format: createFormat, note: createNote }),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateNote('');
      void qc.invalidateQueries({ queryKey: ['system-backups'] });
      void qc.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const restoreMut = useMutation({
    mutationFn: (filename: string) => backupApi.restore(filename),
    onSuccess: (data) => {
      setRestoreResult(
        `Tiklash yakunlandi. Tiklangan fayl: ${data.restored_file}${
          data.safety_backup ? ` (Himoya zaxirasi: ${data.safety_backup})` : ''
        }`,
      );
      void qc.invalidateQueries({ queryKey: ['system-backups'] });
      void qc.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (filename: string) => backupApi.delete(filename),
    onSuccess: () => {
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ['system-backups'] });
      void qc.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => backupApi.upload(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['system-backups'] });
      void qc.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const handleCopySha = (sha: string): void => {
    void navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMut.mutate(file);
    }
    e.target.value = '';
  };

  const list = backups.data ?? [];
  const totalMb = list.reduce((acc, cur) => acc + (cur.size_mb || 0), 0);
  const newest = list[0];
  const isStale =
    newest && (Date.now() - new Date(newest.created_at).getTime()) / 3.6e6 > 26;

  return (
    <div className="space-y-4">
      {/* Sarlavha va asosiy ko'rsatkichlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Archive size={16} aria-hidden /> Jami zaxiralar
          </div>
          <div className="mt-1 text-2xl font-bold">{list.length} ta</div>
          <div className="text-xs text-gray-400">
            {list.filter((b) => b.is_safety).length} ta himoya nusxasi
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <HardDrive size={16} aria-hidden /> Umumiy hajm
          </div>
          <div className="mt-1 text-2xl font-bold">
            {totalMb > 1024
              ? `${(totalMb / 1024).toFixed(2)} GB`
              : `${totalMb.toFixed(2)} MB`}
          </div>
          <div className="text-xs text-gray-400">Diskda band qilingan</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 size={16} aria-hidden /> Oxirgi zaxira
          </div>
          <div className="mt-1 text-lg font-semibold">
            {newest ? ago(newest.created_at) : 'Mavjud emas'}
          </div>
          <div className="text-xs text-gray-400">
            {newest ? formatDate(newest.created_at) : "Hali zaxira olinmagan"}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldAlert size={16} aria-hidden /> Zaxira holati
          </div>
          <div className="mt-1">
            {list.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Nusxa yo'q
              </span>
            ) : isStale ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-pending/10 px-2.5 py-0.5 text-xs font-medium text-pending">
                <AlertTriangle size={12} aria-hidden /> Eskirgan (&gt;26 soat)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 size={12} aria-hidden /> Tizim himoyalangan
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-400">Har kecha 02:00 da avtomatik</div>
        </div>
      </div>

      {/* Amallar paneli */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <>
              <button
                className="btn-brand flex items-center gap-1.5 px-3 py-1.5 text-sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} aria-hidden /> Yangi zaxira yaratish
              </button>

              <button
                className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"
                disabled={uploadMut.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden />
                {uploadMut.isPending ? 'Yuklanmoqda…' : 'Zaxira faylini yuklash'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql.gz,.json.gz,.sqlite3.gz,.sql,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}

          <button
            className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"
            onClick={() => void backups.refetch()}
            disabled={backups.isFetching}
          >
            <RefreshCw
              size={15}
              className={backups.isFetching ? 'animate-spin' : ''}
              aria-hidden
            />
            Yangilash
          </button>
        </div>

        {!isSuperAdmin && (
          <span className="text-xs text-gray-400">
            ℹ️ Yangi zaxira yaratish va tiklash faqat Bosh Admin (SUPER_ADMIN) ga
            ochiq.
          </span>
        )}
      </div>

      {uploadMut.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Fayl yuklashda xatolik: {extractApiError(uploadMut.error)}
        </p>
      )}

      {/* Zaxiralar ro'yxati jadvali */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b border-gray-100 p-4 dark:border-gray-800">
          <h2 className="font-semibold">Mavjud zaxira nusxalari</h2>
          <p className="text-xs text-gray-400">
            Tizim ma'lumotlar bazasi zaxiralari va tiklash tarixi
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="py-3 pl-4 pr-3">Fayl nomi</th>
                <th className="py-3 px-3">Format</th>
                <th className="py-3 px-3">Turi</th>
                <th className="py-3 px-3">Hajmi</th>
                <th className="py-3 px-3">Sana va vaqt</th>
                <th className="py-3 px-3">Xesh (SHA-256)</th>
                <th className="py-3 pl-3 pr-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {backups.isLoading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    Zaxiralar ro'yxati yuklanmoqda…
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    Hozircha birorta ham zaxira fayli mavjud emas. Yuqoridagi «Yangi
                    zaxira yaratish» tugmasi orqali dastlabki nusxani yarating.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr
                    key={item.filename}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 pl-4 pr-3 font-medium">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs sm:text-sm">
                          {item.filename}
                        </span>
                        {item.note && (
                          <span className="text-xs text-gray-400">
                            {item.note}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          item.format === 'sql'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : item.format === 'json'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                        }`}
                      >
                        {item.format}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {item.is_safety ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Himoya nusxasi
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Standart</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-xs">
                      {item.size_mb > 0
                        ? `${item.size_mb} MB`
                        : `${Math.round(item.size_bytes / 1024)} KB`}
                    </td>

                    <td className="py-3 px-3 text-xs text-gray-500">
                      <div>{formatDate(item.created_at)}</div>
                      <div className="text-gray-400">{ago(item.created_at)}</div>
                    </td>

                    <td className="py-3 px-3 font-mono text-xs text-gray-400">
                      <button
                        className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                        title="SHA-256 xeshni nusxalash"
                        onClick={() => handleCopySha(item.checksum_sha256)}
                      >
                        <span>{item.checksum_sha256.substring(0, 10)}…</span>
                        {copiedSha === item.checksum_sha256 ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </td>

                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isSuperAdmin && (
                          <button
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            title="Faylni yuklab olish"
                            onClick={() => void backupApi.download(item.filename)}
                          >
                            <Download size={16} aria-hidden />
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            className="rounded-lg p-1.5 text-pending hover:bg-pending/10"
                            title="Zaxiradan tiklash"
                            onClick={() => {
                              setRestoreTarget(item);
                              setRestoreConfirmChecked(false);
                              setRestoreResult(null);
                            }}
                          >
                            <RotateCcw size={16} aria-hidden />
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                            title="Zaxirani o'chirish"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yangi zaxira yaratish modali */}
      <Modal
        open={createOpen}
        title="Yangi zaxira nusxasi yaratish"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Format turi</label>
            <select
              className="input w-full"
              value={createFormat}
              onChange={(e) =>
                setCreateFormat(e.target.value as 'auto' | 'sql' | 'json')
              }
            >
              <option value="auto">
                Avtomatik (tavsiya etiladi — PostgreSQL / SQLite ga mos)
              </option>
              <option value="json">
                Universal JSON (.json.gz) — platformadan qat'i nazar
              </option>
              <option value="sql">PostgreSQL SQL dump (.sql.gz)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Izoh (ixtiyoriy)
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="Masalan: Relizdan oldingi holat yoki oy yakuni"
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
            />
          </div>

          {createMut.isError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {extractApiError(createMut.error)}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn px-4 py-2 text-sm"
              onClick={() => setCreateOpen(false)}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn-brand px-4 py-2 text-sm"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Yaratilmoqda…' : 'Zaxiralashni boshlash'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Tiklash xavfli amal modali */}
      <Modal
        open={restoreTarget !== null}
        title="Zaxiradan tiklash (Restore)"
        onClose={() => {
          if (!restoreMut.isPending) setRestoreTarget(null);
        }}
      >
        {restoreTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={18} aria-hidden /> DIQQAT: Jiddiy operatsiya!
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                Siz hozir tizim ma'lumotlarini <b>{restoreTarget.filename}</b> zaxirasi
                bilan almashtirmoqchisiz. Tiklashdan so'ng joriy holat ushbu
                zaxiradagi ma'lumotlar bilan qayta tiklanadi.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-800">
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Zaxira fayli:</span>
                <span className="font-mono font-medium">
                  {restoreTarget.filename}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Yaratilgan sana:</span>
                <span>{formatDate(restoreTarget.created_at)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Hajmi:</span>
                <span>{restoreTarget.size_mb} MB</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div>
                <b>Avtomatik himoya:</b> Tiklash boshlanishidan oldin tizim
                avtomatik ravishda hozirgi bazaning yangi <i>pre-restore safety</i>{' '}
                zaxira nusxasini oladi. Hech qanday ma'lumot yo'qolmaydi.
              </div>
            </div>

            {restoreResult ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 size={16} className="shrink-0" aria-hidden />
                <span>{restoreResult}</span>
              </div>
            ) : (
              <label className="flex cursor-pointer items-start gap-2 pt-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-brand focus:ring-brand"
                  checked={restoreConfirmChecked}
                  onChange={(e) => setRestoreConfirmChecked(e.target.checked)}
                />
                <span>
                  Men bazadagi ma'lumotlar tanlangan zaxira nusxasi bilan
                  almashtirilishini tushunaman va tasdiqlayman.
                </span>
              </label>
            )}

            {restoreMut.isError && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {extractApiError(restoreMut.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn px-4 py-2 text-sm"
                disabled={restoreMut.isPending}
                onClick={() => setRestoreTarget(null)}
              >
                {restoreResult ? 'Yopish' : 'Bekor qilish'}
              </button>

              {!restoreResult && (
                <button
                  type="button"
                  className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger/90 disabled:opacity-50"
                  disabled={!restoreConfirmChecked || restoreMut.isPending}
                  onClick={() => restoreMut.mutate(restoreTarget.filename)}
                >
                  {restoreMut.isPending ? 'Tiklanmoqda…' : 'Tiklashni boshlash'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* O'chirish modali */}
      <Modal
        open={deleteTarget !== null}
        title="Zaxira nusxasini o'chirish"
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="space-y-4 text-sm">
            <p>
              Haqiqatan ham quyidagi zaxira faylini o'chirmoqchimisiz?
            </p>
            <p className="rounded-lg bg-gray-100 p-2 font-mono text-xs dark:bg-gray-800">
              {deleteTarget.filename} ({deleteTarget.size_mb} MB)
            </p>

            {deleteMut.isError && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {extractApiError(deleteMut.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn px-4 py-2 text-sm"
                onClick={() => setDeleteTarget(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger/90 disabled:opacity-50"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteTarget.filename)}
              >
                {deleteMut.isPending ? "O'chirilmoqda…" : "O'chirish"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
