import { useMutation } from '@tanstack/react-query';
import { BookOpen, Monitor } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '@/shared/api/auth';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { getPaperWidth, setPaperWidth } from '@/mobile/lib/btPrinter';
import { PinSettings } from '@/mobile/PinSettings';
import { TelegramConnect } from '@/shared/components/TelegramConnect';
import { pullReferenceData } from '@/offline/sync';
import { setDesktopForced } from '@/shared/lib/useIsMobile';
import { useAuthStore } from '@/shared/store/authStore';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'BRANCH_MANAGER', 'ACCOUNTANT'];

export function ProfilePage(): ReactElement {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const isAdmin = user?.role != null && ADMIN_ROLES.includes(user.role);

  const refresh = useMutation({ mutationFn: () => pullReferenceData() });
  const [paper, setPaper] = useState<32 | 48>(getPaperWidth);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      <div className="rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
        <div className="font-medium">{user?.full_name}</div>
        <div className="text-gray-500">{user?.phone}</div>
      </div>

      <TelegramConnect />
      <LanguageSwitch />
      <PinSettings />

      <label className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm shadow-sm dark:bg-gray-900">
        <span>Chek printeri qog‘ozi</span>
        <select
          className="field max-w-[140px]"
          value={paper}
          onChange={(e) => {
            const width = e.target.value === '48' ? 48 : 32;
            setPaper(width);
            setPaperWidth(width);
          }}
        >
          <option value="32">58 mm</option>
          <option value="48">80 mm</option>
        </select>
      </label>

      <Link to="/m/help" className="btn flex w-full items-center justify-center gap-2">
        <BookOpen size={18} aria-hidden />
        <span>Foydalanish yo'riqnomasi</span>
      </Link>

      {isAdmin && (
        <button
          className="btn flex w-full items-center justify-center gap-2"
          onClick={() => {
            setDesktopForced(true);
            window.location.href = '/admin';
          }}
        >
          <Monitor size={18} aria-hidden />
          <span>To'liq (desktop) versiyaga o'tish</span>
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
            void navigate('/login', { replace: true });
          });
        }}
      >
        Chiqish
      </button>
    </div>
  );
}
