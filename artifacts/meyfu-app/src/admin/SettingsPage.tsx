import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BookOpen, ShieldAlert, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { extractApiError } from '@/shared/api/client';
import { systemApi } from '@/shared/api/system';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { TelegramConnect } from '@/shared/components/TelegramConnect';
import { roleLabel } from '@/shared/lib/labels';
import { useAuthStore } from '@/shared/store/authStore';

import { CompanySettingsForm } from './CompanySettingsForm';

export function SettingsPage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const sysSettings = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => systemApi.getSettings(),
  });

  const toggleCleanup = useMutation({
    mutationFn: (enabled: boolean) =>
      systemApi.updateSettings({ allow_test_cleanup: enabled }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['system-settings'] });
      void qc.invalidateQueries({ queryKey: ['cleanup-entries'] });
      setSavedNotice(
        data.allow_test_cleanup
          ? "Soxta tranzaksiyalarni tozalash ruxsati yoqildi."
          : "Soxta tranzaksiyalarni tozalash ruxsati o'chirildi.",
      );
      window.setTimeout(() => setSavedNotice(null), 3000);
    },
  });

  const allowTestCleanup = sysSettings.data?.allow_test_cleanup ?? false;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Sozlamalar</h1>

      <div className="max-w-lg rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
        <div className="flex justify-between">
          <span className="text-gray-500">Foydalanuvchi</span>
          <span className="font-medium">{user?.full_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Telefon</span>
          <span>{user?.phone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Rol</span>
          <span>{roleLabel(user?.role)}</span>
        </div>
      </div>

      <div className="max-w-lg space-y-4">
        <TelegramConnect />
        <LanguageSwitch />

        {/* Soxta tranzaksiyalarni tozalashga ruxsat berish/o'chirish sozlamasi */}
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
              <div>
                <div className="text-sm font-semibold">
                  Soxta tranzaksiyalarni tozalash ruxsati
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Sinov (test) jarayonida kiritilgan soxta operatsiyalarni va ularga
                  bog‘liq balanslarni xavfsiz tozalash imkoniyatini yoqish yoki o‘chirish.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allowTestCleanup}
              aria-label="Soxta tranzaksiyalarni tozalashga ruxsat berish"
              disabled={!isSuperAdmin || sysSettings.isLoading || toggleCleanup.isPending}
              onClick={() => toggleCleanup.mutate(!allowTestCleanup)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                allowTestCleanup ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowTestCleanup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-xs dark:border-gray-800">
            <span
              className={
                allowTestCleanup
                  ? 'font-medium text-success'
                  : 'font-medium text-gray-400'
              }
            >
              Holat: {allowTestCleanup ? 'Ruxsat berilgan (Yoqilgan)' : "Taqiqlangan (O'chirilgan)"}
            </span>

            {isSuperAdmin ? (
              allowTestCleanup && (
                <Link
                  to="/admin/system?tab=cleanup"
                  className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"
                >
                  <Trash2 size={14} aria-hidden />
                  <span>Tranzaksiyalarni tozalash oynasiga o‘tish →</span>
                </Link>
              )
            ) : (
              <span className="text-gray-400">Faqat SUPER_ADMIN o‘zgartira oladi</span>
            )}
          </div>

          {toggleCleanup.isError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {extractApiError(toggleCleanup.error)}
            </p>
          )}
          {savedNotice && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              {savedNotice}
            </p>
          )}
        </div>

        <Link
          to="/admin/system?tab=backups"
          className="flex items-center gap-3 rounded-xl bg-white p-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <Archive size={18} className="text-brand shrink-0" aria-hidden />
          <span>Zaxiralash va tiklash (Backup & Restore)</span>
        </Link>
        {isSuperAdmin && (
          <Link
            to="/admin/system?tab=cleanup"
            className="flex items-center gap-3 rounded-xl bg-white p-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <Trash2 size={18} className="text-danger shrink-0" aria-hidden />
            <span>Soxta ma’lumotlarni (tranzaksiyalarni) tozalash</span>
          </Link>
        )}
        <Link
          to="/admin/help"
          className="flex items-center gap-3 rounded-xl bg-white p-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <BookOpen size={18} className="text-brand shrink-0" aria-hidden />
          <span>Foydalanish yo'riqnomasi — rol bo'yicha</span>
        </Link>
      </div>

      <CompanySettingsForm />
    </div>
  );
}
