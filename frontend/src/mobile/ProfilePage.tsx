import { useMutation } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '@/shared/api/auth';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { TelegramConnect } from '@/shared/components/TelegramConnect';
import { pullReferenceData } from '@/offline/sync';
import { setDesktopForced } from '@/shared/lib/useIsMobile';
import { useAuthStore } from '@/shared/store/authStore';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'];

export function ProfilePage(): ReactElement {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const isAdmin = user?.role != null && ADMIN_ROLES.includes(user.role);

  const refresh = useMutation({ mutationFn: () => pullReferenceData() });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
        <div className="font-medium">{user?.full_name}</div>
        <div className="text-gray-500">{user?.phone}</div>
      </div>

      <TelegramConnect />
      <LanguageSwitch />

      <Link to="/m/help" className="btn flex w-full items-center justify-center gap-2">
        📖 Foydalanish yo'riqnomasi
      </Link>

      {isAdmin && (
        <button
          className="btn w-full"
          onClick={() => {
            setDesktopForced(true);
            window.location.href = '/admin';
          }}
        >
          🖥 To'liq (desktop) versiyaga o'tish
        </button>
      )}

      <button
        className="btn w-full"
        disabled={refresh.isPending}
        onClick={() => refresh.mutate()}
      >
        {refresh.isPending ? 'Yangilanmoqda…' : 'Katalogni yangilash'}
      </button>

      <button
        className="btn w-full text-danger"
        onClick={() => {
          void logout().finally(() => {
            clear();
            navigate('/login', { replace: true });
          });
        }}
      >
        Chiqish
      </button>
    </div>
  );
}
