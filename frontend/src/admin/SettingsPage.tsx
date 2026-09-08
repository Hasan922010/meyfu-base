import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { TelegramConnect } from '@/shared/components/TelegramConnect';
import { useAuthStore } from '@/shared/store/authStore';

import { CompanySettingsForm } from './CompanySettingsForm';

export function SettingsPage(): ReactElement {
  const user = useAuthStore((s) => s.user);

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
          <span>{user?.role}</span>
        </div>
      </div>

      <div className="max-w-lg space-y-4">
        <TelegramConnect />
        <LanguageSwitch />
        <Link
          to="/admin/help"
          className="block rounded-xl bg-white p-4 text-sm font-medium shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          📖 Foydalanish yo'riqnomasi — rol bo'yicha
        </Link>
      </div>

      <CompanySettingsForm />
    </div>
  );
}
