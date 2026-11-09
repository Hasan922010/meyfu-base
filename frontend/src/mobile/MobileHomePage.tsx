import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  Coins,
  HandCoins,
  MapPin,
  PackageOpen,
  Receipt,
  Truck,
  Undo2,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { clientsApi } from '@/shared/api/clients';
import { dayCloseApi } from '@/shared/api/reports';
import { warehouseApi } from '@/shared/api/warehouse';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

import { WalletCard } from './WalletCard';

/**
 * 7 yoshli bola ham bir qarashda tushunadigan mobil Bosh sahifa (Zero-Learning-Curve UX):
 * 1. Aniq salomlashish va kassa holati
 * 2. Katta yashil asosiy harakat (Primary CTA: + Yangi Sotuv)
 * 3. 4 ta asosiy tezkor rangli kartochkalar
 * 4. Qulay marshrutlar ro'yxati
 */
export function MobileHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const routes = useQuery({
    queryKey: ['routes', 'my'],
    queryFn: () => clientsApi.myRoutes(),
  });
  const today = useQuery({
    queryKey: ['day-close', 'my-today'],
    queryFn: () => dayCloseApi.myToday(),
  });
  const loadings = useQuery({
    queryKey: ['loadings', 'my-today'],
    queryFn: () => warehouseApi.myTodayLoadings(),
  });
  const awaitingLoadings = (loadings.data ?? []).filter((l) => l.status === 'SENT');

  return (
    <div className="space-y-4">
      {/* 1. Foydalanuvchi salomlashishi */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
            Assalomu alaykum!
          </h1>
          <p className="text-xs font-medium text-gray-500">
            {user?.full_name || 'Tarqatuvchi'} · Ish faoliyati
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          Faol
        </span>
      </div>

      {/* 2. Kassa va cho'ntakdagi pul kartochkasi */}
      <WalletCard />

      {/* 3. Bugungi savdo natijasi (agar savdo boshlangan bo'lsa) */}
      {today.data && !today.data.submitted && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3.5 text-center shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <div className="text-[11px] font-medium text-gray-500">Bugungi savdo</div>
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {money(today.data.sold_amount ?? '0')}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500">Sotuvlar</div>
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              {today.data.sales_count ?? 0} ta
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500">Tashriflar</div>
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              {today.data.visits_count ?? 0} ta
            </div>
          </div>
        </div>
      )}

      {/* 4. Kutilayotgan yuklama (agar bo'lsa, diqqatni tortuvchi katta banner) */}
      {awaitingLoadings.length > 0 && (
        <Link
          to="/m/loading"
          className="flex items-center gap-3 rounded-2xl border-2 border-warning/40 bg-warning/10 p-3.5 text-sm transition hover:bg-warning/20 active:scale-[0.99]"
        >
          <PackageOpen size={30} className="shrink-0 text-warning-700 dark:text-warning-300" aria-hidden />
          <span className="flex-1">
            <span className="block font-bold text-warning-900 dark:text-warning-100">
              Ombordan yuklama keldi!
            </span>
            <span className="block text-xs text-warning-800/80 dark:text-warning-200/80">
              {awaitingLoadings.map((l) => l.number).join(', ')} · Tovarni sanab, qabul qiling
            </span>
          </span>
          <span aria-hidden className="text-lg font-bold text-warning-700">
            →
          </span>
        </Link>
      )}

      {/* 5. Asosiy Bosh Harakatlar (Primary CTA) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/m/sale"
          className="btn min-h-[58px] flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition"
        >
          <Banknote size={26} aria-hidden />
          <span>+ Yangi Sotuv Qilish</span>
        </Link>
        <Link
          to="/m/close"
          className={`btn min-h-[54px] flex items-center justify-center gap-2.5 rounded-2xl font-bold text-base border-2 transition active:scale-[0.98] ${
            today.data?.submitted
              ? 'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400'
              : 'border-pending/40 bg-pending/5 text-pending hover:bg-pending/10'
          }`}
        >
          <CalendarCheck size={20} aria-hidden />
          <span>{today.data?.submitted ? 'Kun yopilgan' : 'Kunni Yopish (Kassa)'}</span>
        </Link>
      </div>

      {/* 6. "4 ta Asosiy Tezkor Harakat" (2x2 rangli ergonomik kartochkalar) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
          Asosiy bo'limlar
        </span>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/m/orders"
            className="flex flex-col justify-between rounded-2xl bg-blue-50/70 p-4 border border-blue-100 hover:border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <ClipboardList size={24} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-blue-950 dark:text-blue-100">
                Buyurtmalar
              </span>
              <span className="block text-xs font-medium text-blue-700/80 dark:text-blue-300/80">
                Yetkazish ro‘yxati
              </span>
            </div>
          </Link>

          <Link
            to="/m/van"
            className="flex flex-col justify-between rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100 hover:border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <Truck size={24} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm text-emerald-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-emerald-950 dark:text-emerald-100">
                Mashina Qoldig‘i
              </span>
              <span className="block text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                Hozir bor tovarlar
              </span>
            </div>
          </Link>

          <Link
            to="/m/debts"
            className="flex flex-col justify-between rounded-2xl bg-amber-50/70 p-4 border border-amber-100 hover:border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <HandCoins size={24} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-amber-950 dark:text-amber-100">
                Qarz Undirish
              </span>
              <span className="block text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
                Nasiya pullarni yig‘ish
              </span>
            </div>
          </Link>

          <Link
            to="/m/expenses"
            className="flex flex-col justify-between rounded-2xl bg-purple-50/70 p-4 border border-purple-100 hover:border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <Receipt size={24} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-purple-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-purple-950 dark:text-purple-100">
                Xarajat Yozish
              </span>
              <span className="block text-xs font-medium text-purple-700/80 dark:text-purple-300/80">
                Yoqilg‘i, tushlik va h.k.
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* 7. Qo'shimcha Xizmatlar (Yilni 4 talik qator) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
          Xizmatlar
        </span>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            to="/m/return/new"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <Undo2 size={22} className="text-rose-500" aria-hidden />
            <span className="truncate">Qaytarish</span>
          </Link>
          <Link
            to="/m/visits"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <MapPin size={22} className="text-indigo-500" aria-hidden />
            <span className="truncate">Tashrif</span>
          </Link>
          <Link
            to="/m/report"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <ChartColumn size={22} className="text-brand" aria-hidden />
            <span className="truncate">Hisobot</span>
          </Link>
          <Link
            to="/m/payroll"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <Coins size={22} className="text-amber-500" aria-hidden />
            <span className="truncate">Maosh</span>
          </Link>
        </div>
      </div>

      {/* 8. Mening Marshrutlarim */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Mening marshrutlarim
          </span>
          <Link to="/m/clients" className="text-xs font-semibold text-brand hover:underline">
            Barcha mijozlar →
          </Link>
        </div>
        {routes.data?.length ? (
          <div className="space-y-2">
            {routes.data.map((r) => (
              <Link
                key={r.id}
                to="/m/clients"
                className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-xs border border-gray-100 hover:border-brand/30 dark:border-gray-800 dark:bg-gray-900 transition active:scale-[0.99]"
              >
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    {r.days_display.join(', ') || 'Kunlar belgilanmagan'}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {r.clients_count} ta do‘kon
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-4 text-center text-xs text-gray-400 border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
            Hozircha marshrut biriktirilmagan.
          </p>
        )}
      </section>
    </div>
  );
}
