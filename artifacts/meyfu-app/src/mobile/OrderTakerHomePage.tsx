import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ClipboardList,
  Coins,
  HandCoins,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ordersApi } from '@/shared/api/orders';
import { businessDateISO } from '@/shared/lib/businessDay';
import { money } from '@/shared/lib/format';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * Savdo agenti uchun "7 yoshli bola testi" darajasidagi sodda bosh sahifa:
 * 1. Bugungi natija (yirik raqamlar)
 * 2. Katta ko'k asosiy harakat (+ Yangi Buyurtma Olish)
 * 3. 4 ta asosiy tezkor bo'lim (Buyurtmalar, Mijozlar, Ombor, Maosh)
 */
export function OrderTakerHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const orders = useQuery({
    queryKey: ['orders', 'my-to-take'],
    queryFn: () => ordersApi.myToTake(),
  });

  const today = businessDateISO();
  const todays = (orders.data ?? []).filter(
    (o) => o.date === today && o.status !== 'CANCELLED',
  );
  const total = todays.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="space-y-4">
      {/* 1. Salomlashish */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
            Assalomu alaykum!
          </h1>
          <p className="text-xs font-medium text-gray-500">
            {user?.full_name || 'Agent'} · Buyurtma olish
          </p>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          Agent
        </span>
      </div>

      {/* 2. Bugungi ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] font-medium text-gray-500">Bugungi buyurtmalar</div>
          <div className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">
            {orders.isLoading ? '…' : todays.length}{' '}
            <span className="text-xs font-semibold text-gray-400">ta</span>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-[11px] font-medium text-gray-500">Buyurtma summasi</div>
          <div className="mt-1 text-lg font-black text-blue-600 dark:text-blue-400 truncate">
            {orders.isLoading ? '…' : money(total)}
          </div>
        </div>
      </div>

      {/* 3. Bitta Katta Asosiy Harakat (Primary CTA) */}
      <Link
        to="/m/order/new"
        className="btn min-h-[58px] flex w-full items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-md shadow-blue-600/20 active:scale-[0.98] transition"
      >
        <Plus size={26} aria-hidden />
        <span>+ Yangi Buyurtma Olish</span>
      </Link>

      {/* 4. "4 ta Asosiy Bo'lim" (2x2 rangli ergonomik kartochkalar) */}
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
                Buyurtmalarim
              </span>
              <span className="block text-xs font-medium text-blue-700/80 dark:text-blue-300/80">
                Olingan buyurtmalar
              </span>
            </div>
          </Link>

          <Link
            to="/m/clients"
            className="flex flex-col justify-between rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100 hover:border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <Store size={24} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm text-emerald-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-emerald-950 dark:text-emerald-100">
                Mijozlarim
              </span>
              <span className="block text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80">
                Do‘konlar va manzillar
              </span>
            </div>
          </Link>

          <Link
            to="/m/stock"
            className="flex flex-col justify-between rounded-2xl bg-amber-50/70 p-4 border border-amber-100 hover:border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <Package size={24} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-amber-950 dark:text-amber-100">
                Ombor Qoldig‘i
              </span>
              <span className="block text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
                Qaysi tovardan bor
              </span>
            </div>
          </Link>

          <Link
            to="/m/payroll"
            className="flex flex-col justify-between rounded-2xl bg-purple-50/70 p-4 border border-purple-100 hover:border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <Coins size={24} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-purple-500 font-bold">→</span>
            </div>
            <div className="mt-3">
              <span className="block font-black text-base text-purple-950 dark:text-purple-100">
                Mening Maoshim
              </span>
              <span className="block text-xs font-medium text-purple-700/80 dark:text-purple-300/80">
                Bonus va komissiya
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* 5. Qo'shimcha xizmatlar */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
          Xizmatlar
        </span>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            to="/m/visits"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <MapPin size={22} className="text-indigo-500" aria-hidden />
            <span className="truncate">Tashrif</span>
          </Link>
          <Link
            to="/m/debts"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <HandCoins size={22} className="text-amber-500" aria-hidden />
            <span className="truncate">Qarzdorlar</span>
          </Link>
          <Link
            to="/m/sync"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <RefreshCw size={22} className="text-brand" aria-hidden />
            <span className="truncate">Sinxron</span>
          </Link>
          <Link
            to="/m/help"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-xs border border-gray-100 dark:border-gray-800 dark:bg-gray-900 active:scale-95 transition"
          >
            <BookOpen size={22} className="text-emerald-500" aria-hidden />
            <span className="truncate">Yordam</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
