import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { extractApiError } from '@/shared/api/client';
import {
  systemApi,
  type CleanupLedgerKey,
  type TestCleanupPreviewResponse,
} from '@/shared/api/system';
import { DataState } from '@/shared/components/DataState';
import { Modal } from '@/shared/components/Modal';
import { dateShort, money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

const LEDGERS: { id: CleanupLedgerKey; label: string; isQty?: boolean }[] = [
  { id: 'finance.cashtransaction', label: 'Kassa operatsiyalari' },
  { id: 'wallet.wallettransaction', label: 'Xodim hamyoni operatsiyalari' },
  { id: 'warehouse.suppliertransaction', label: "Ta'minotchi operatsiyalari" },
  {
    id: 'warehouse.stockmovement',
    label: 'Ombor harakatlari (boshlang‘ich qoldiq / tuzatish)',
    isQty: true,
  },
];

export function TestCleanupSection(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [ledger, setLedger] = useState<CleanupLedgerKey>('finance.cashtransaction');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<TestCleanupPreviewResponse | null>(null);
  const [reason, setReason] = useState<string>('');
  const [confirmation, setConfirmation] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const entriesQuery = useQuery({
    queryKey: ['cleanup-entries', ledger],
    queryFn: () => systemApi.cleanupEntries(ledger, 100),
    enabled: isSuperAdmin,
  });

  const toggleSettingMut = useMutation({
    mutationFn: (enabled: boolean) =>
      systemApi.updateSettings({ allow_test_cleanup: enabled }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cleanup-entries'] });
      void qc.invalidateQueries({ queryKey: ['system-settings'] });
    },
  });

  const previewMut = useMutation({
    mutationFn: () => systemApi.cleanupPreview({ ledger, ids: selectedIds }),
    onSuccess: (data) => {
      setPreview(data);
      setReason('');
      setConfirmation('');
      setPassword('');
      setAcknowledged(false);
    },
  });

  const executeMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('Preview topilmadi');
      return systemApi.cleanupExecute({
        ledger,
        ids: preview.selected_ids,
        cleanup_token: preview.cleanup_token,
        reason: reason.trim(),
        confirmation: confirmation.trim().toUpperCase(),
        password,
        acknowledged,
      });
    },
    onSuccess: (res) => {
      setPreview(null);
      setSelectedIds([]);
      setSuccessMsg(res.message);
      void qc.invalidateQueries({ queryKey: ['cleanup-entries'] });
      void qc.invalidateQueries({ queryKey: ['system-status'] });
      window.setTimeout(() => setSuccessMsg(null), 6000);
    },
  });

  const isQtyLedger = ledger === 'warehouse.stockmovement';
  const allowCleanup = entriesQuery.data?.allow_test_cleanup ?? false;

  const filteredEntries = useMemo(() => {
    const list = entriesQuery.data?.entries ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.target_name.toLowerCase().includes(q) ||
        e.type_display.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q) ||
        e.counterparty.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [entriesQuery.data?.entries, search]);

  const closePreviewModal = useCallback((): void => {
    if (!executeMut.isPending) setPreview(null);
  }, [executeMut.isPending]);

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:bg-gray-900">
        Soxta operatsiyalarni tozalash faqat Bosh Admin (SUPER_ADMIN) uchun ochiq.
      </div>
    );
  }

  function handleLedgerChange(next: CleanupLedgerKey): void {
    setLedger(next);
    setSelectedIds([]);
    previewMut.reset();
  }

  function toggleRow(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAllVisible(): void {
    const visibleIds = filteredEntries.map((e) => e.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])).slice(0, 100));
    }
  }

  const formatVal = (v: string): string =>
    isQtyLedger ? v : money(v);

  return (
    <div className="space-y-4">
      {/* Ogohlantirish va ruxsat holati */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert
              size={20}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <div className="space-y-1">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Faqat sinov (test) jarayonidagi soxta operatsiyalarni tozalash uchun
              </div>
              <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/80">
                Haqiqiy operatsiyalar tarixini buzmaslik uchun faqat balansdagi oxirgi
                soxta yozuvlar guruhi tozalanadi. Tanlangan operatsiya bilan bog‘liq
                hujjatlar (sotuv, qarz, xarajat, naqd topshirish) faol hisoblardan
                chiqariladi, balanslar moslanadi va Audit jurnalida to‘liq nusxasi saqlanadi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${allowCleanup
                  ? 'bg-success/15 text-success'
                  : 'bg-danger/15 text-danger'
                }`}
            >
              {allowCleanup ? 'Ruxsat yoqilgan' : "Ruxsat o'chirilgan"}
            </span>
            <button
              type="button"
              className="btn px-3 py-1 text-xs"
              disabled={toggleSettingMut.isPending}
              onClick={() => toggleSettingMut.mutate(!allowCleanup)}
            >
              {allowCleanup ? "Ruxsatni o'chirish" : 'Ruxsatni yoqish'}
            </button>
            <Link
              to="/admin/settings"
              className="text-xs font-medium text-brand hover:underline"
            >
              Sozlamalar →
            </Link>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          <span>{successMsg}</span>
        </div>
      )}

      {previewMut.isError && (
        <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {extractApiError(previewMut.error)}
        </div>
      )}

      {/* Jurnal tanlash va qidiruv paneli */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2">
          {LEDGERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleLedgerChange(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${ledger === item.id
                  ? 'bg-brand text-brand-fg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="text"
              className="field pl-8 text-sm"
              placeholder="Qidirish (hisob, izoh, tur)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"
            onClick={() => void entriesQuery.refetch()}
            disabled={entriesQuery.isFetching}
          >
            <RefreshCw
              size={15}
              className={entriesQuery.isFetching ? 'animate-spin' : ''}
              aria-hidden
            />
            Yangilash
          </button>

          <button
            type="button"
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger/90 disabled:opacity-50"
            disabled={
              !allowCleanup || selectedIds.length === 0 || previewMut.isPending
            }
            onClick={() => previewMut.mutate()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Trash2 size={16} aria-hidden />
              {previewMut.isPending
                ? 'Tekshirilmoqda…'
                : `Tanlanganlarni tozalash (${selectedIds.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Yozuvlar jadvali */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <DataState
          isLoading={entriesQuery.isLoading}
          isError={entriesQuery.isError}
          isEmpty={!entriesQuery.isLoading && filteredEntries.length === 0}
          emptyText="Ushbu jurnalda faol operatsiyalar topilmadi"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    aria-label="Barchasini tanlash"
                    disabled={!allowCleanup || filteredEntries.length === 0}
                    checked={
                      filteredEntries.length > 0 &&
                      filteredEntries.every((e) => selectedIds.includes(e.id))
                    }
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="p-3">Sana</th>
                <th className="p-3">Hisob / Obyekt</th>
                <th className="p-3">Turi</th>
                <th className="p-3">Izoh / Havola</th>
                <th className="p-3 text-right">
                  {isQtyLedger ? 'Miqdor' : 'Summa'}
                </th>
                <th className="p-3 text-right">Keyingi balans</th>
                <th className="p-3">Kim kiritdi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredEntries.map((entry) => {
                const checked = selectedIds.includes(entry.id);
                const num = Number(entry.amount);
                return (
                  <tr
                    key={entry.id}
                    onClick={() => {
                      if (allowCleanup) toggleRow(entry.id);
                    }}
                    className={`cursor-pointer transition-colors ${checked
                        ? 'bg-danger/5 dark:bg-danger/10'
                        : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/50'
                      }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        disabled={!allowCleanup}
                        checked={checked}
                        onChange={() => toggleRow(entry.id)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                      <div>{dateShort(entry.date)}</div>
                      <div className="font-mono text-[11px] text-gray-400">
                        {entry.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="p-3 font-medium">
                      <div>{entry.target_name}</div>
                      {entry.counterparty && (
                        <div className="text-xs text-gray-400">{entry.counterparty}</div>
                      )}
                    </td>
                    <td className="p-3">{entry.type_display}</td>
                    <td className="p-3 text-xs text-gray-500">
                      <div>{entry.note || '—'}</div>
                      {entry.reference_type && (
                        <div className="font-mono text-[11px] text-gray-400">
                          {entry.reference_type}
                          {entry.reference_id ? ` #${entry.reference_id.slice(0, 8)}` : ''}
                        </div>
                      )}
                    </td>
                    <td
                      className={`p-3 text-right font-semibold ${num < 0 ? 'text-danger' : 'text-success'
                        }`}
                    >
                      {num > 0 ? '+' : ''}
                      {formatVal(entry.amount)}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatVal(entry.balance_after)}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {entry.actor_name || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>

      {/* Preview va Tasdiqlash modali */}
      <Modal
        open={preview !== null}
        title="Tanlangan soxta operatsiyalarni tozalashni tasdiqlash"
        onClose={closePreviewModal}
      >
        {preview && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={16} aria-hidden /> DIQQAT: Faqat soxta ma’lumotlar uchun!
              </div>
              <p className="mt-1 text-gray-700 dark:text-gray-300">
                Bu amal tanlangan yozuvlar bilan birga quyida ko‘rsatilgan bog‘liq
                hujjatlarni ham faol hisoblardan chiqaradi va balanslarni qayta moslaydi.
              </p>
            </div>

            <div>
              <div className="mb-1.5 font-semibold">
                Faol hisoblardan chiqariladigan yozuvlar ({preview.rows.length} ta):
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                    <tr>
                      <th className="p-2">Model</th>
                      <th className="p-2">Yozuv</th>
                      <th className="p-2">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {preview.rows.map((r) => (
                      <tr key={`${r.model}-${r.id}`}>
                        <td className="p-2 font-mono text-[11px] text-gray-500">
                          {r.model}
                        </td>
                        <td className="p-2 font-medium">{r.label}</td>
                        <td className="p-2 font-mono text-[11px] text-gray-400">
                          {r.id.slice(0, 8)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-1.5 font-semibold">Balans va qoldiqqa ta’siri:</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                    <tr>
                      <th className="p-2">Hisob / Obyekt</th>
                      <th className="p-2">Maydon</th>
                      <th className="p-2 text-right">Hozir</th>
                      <th className="p-2 text-right">Tozalangandan keyin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {preview.effects.map((eff) =>
                      eff.changes.map((ch) => (
                        <tr key={`${eff.model}-${eff.id}-${ch.field_name}`}>
                          <td className="p-2 font-medium">{eff.label}</td>
                          <td className="p-2 text-gray-500">{ch.field}</td>
                          <td className="p-2 text-right text-gray-500">{ch.old}</td>
                          <td className="p-2 text-right font-semibold text-brand">
                            {ch.new}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <label className="block space-y-1">
                <span className="text-xs font-medium">
                  Nega bu operatsiyalar soxta? (Sabab — kamida 5 ta belgi)
                </span>
                <input
                  type="text"
                  name="cleanup_reason_note"
                  autoComplete="off"
                  className="field"
                  placeholder="Masalan: Sinov paytida kiritilgan test operatsiya"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="flex items-center justify-between gap-2 text-xs font-medium">
                    <span>
                      Tasdiqlash uchun <b>TOZALASH</b> deb yozing
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmation('TOZALASH')}
                      className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                    >
                      TOZALASH
                    </button>
                  </span>
                  <input
                    type="text"
                    name="cleanup_confirm_word"
                    autoComplete="off"
                    className="field font-mono"
                    placeholder="TOZALASH"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium">Joriy admin parolingiz</span>
                  <input
                    type="password"
                    name="cleanup_admin_secret"
                    autoComplete="new-password"
                    className="field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>
                  Bog‘liq yozuvlar va balans ta’sirini tekshirdim; bular haqiqatan ham
                  soxta ma’lumotlar ekanini tasdiqlayman.
                </span>
              </label>
            </div>

            {executeMut.isError && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {extractApiError(executeMut.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn px-4 py-2 text-sm"
                disabled={executeMut.isPending}
                onClick={() => setPreview(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger/90 disabled:opacity-50"
                disabled={
                  executeMut.isPending ||
                  reason.trim().length < 5 ||
                  confirmation.trim().toUpperCase() !== 'TOZALASH' ||
                  !password ||
                  !acknowledged
                }
                onClick={() => executeMut.mutate()}
              >
                {executeMut.isPending ? 'Tozalanmoqda…' : 'Tasdiqlab tozalash'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

