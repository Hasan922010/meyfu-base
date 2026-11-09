import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  ClipboardList,
  ClipboardPen,
  PackagePlus,
  Plus,
  ScanLine,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { warehouseApi } from '@/shared/api/warehouse';
import { useAuthStore } from '@/shared/store/authStore';

/**
 * Omborchi uchun sodda va qulay bosh sahifa:
 * 1. Katta tezkor harakatlar (+ Tarqatish/Sotuv, + Yangi Buyurtma, + Tovar Qabuli)
 * 2. Rangli tezkor bo'limlar (Buyurtmalar, Yuklamalar, Qoldiqlar, Naklit skani, Mijozlar)
 * 3. Kam qolgan tovarlar ogohlantirishi (Svetofor qoidasi)
 */
export function WarehouseHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const low = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: () => warehouseApi.lowStock(),
  });

  return (
    <div className="space-y-4">
      {/* 1. Salomlashish */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
            Assalomu alaykum!
          </h1>
          <p className="text-xs font-medium text-gray-500">
            {user?.full_name || 'Omborchi'} · Ombor & Tarqatish
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          Omborchi
        </span>
      </div>

      {/* 2. Asosiy Yirik Harakatlar (Primary CTAs) */}
      <div className="space-y-2.5">
        {/* Asosiy 1: Tarqatish / Sotuv */}
        <Link
          to="/m/sale"
          className="btn min-h-[56px] flex w-full items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl shadow-md shadow-emerald-600/20 active:scale-[0.98] transition"
        >
          <ShoppingCart size={24} aria-hidden />
          <span>+ Yangi Tarqatish / Sotuv</span>
        </Link>

        {/* Asosiy 2 & 3: Buyurtma Olish va Tovar Qabuli */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            to="/m/order/new"
            className="btn min-h-[50px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-sm active:scale-[0.98] transition"
          >
            <Plus size={20} aria-hidden />
            <span>+ Buyurtma Olish</span>
          </Link>

          <Link
            to="/m/receive"
            className="btn min-h-[50px] flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-2xl shadow-sm active:scale-[0.98] transition"
          >
            <PackagePlus size={20} aria-hidden />
            <span>+ Tovar Qabuli</span>
          </Link>
        </div>
      </div>

      {/* 3. "Asosiy Bo'limlar" (Katta rangli kartochkalar) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ombor Qoldig'i (Katta keng karta) */}
        <Link
          to="/m/stock"
          className="col-span-2 flex items-center justify-between rounded-2xl bg-blue-50/70 p-4 border border-blue-100 hover:border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/30 active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Boxes size={26} />
            </span>
            <div>
              <span className="block font-black text-lg text-blue-950 dark:text-blue-100">
                Ombor Qoldig‘i
              </span>
              <span className="block text-sm font-medium text-blue-700/80 dark:text-blue-300/80">
                Barcha mavjud mahsulotlar zaxirasi
              </span>
            </div>
          </div>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">→</span>
        </Link>

        {/* Buyurtmalarim */}
        <Link
          to="/m/orders"
          className="flex flex-col justify-between rounded-2xl bg-purple-50/70 p-4 border border-purple-100 hover:border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/30 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <ClipboardList size={24} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-purple-500 font-bold">→</span>
          </div>
          <div className="mt-3">
            <span className="block font-black text-base text-purple-950 dark:text-purple-100">
              Buyurtmalarim
            </span>
            <span className="block text-xs font-medium text-purple-700/80 dark:text-purple-300/80">
              Olingan & yetkaziladigan
            </span>
          </div>
        </Link>

        {/* Tarqatish Yuklamalari */}
        <Link
          to="/m/loading"
          className="flex flex-col justify-between rounded-2xl bg-amber-50/70 p-4 border border-amber-100 hover:border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <Truck size={24} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-500 font-bold">→</span>
          </div>
          <div className="mt-3">
            <span className="block font-black text-base text-amber-950 dark:text-amber-100">
              Yuklamalar
            </span>
            <span className="block text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
              Mashina & tarqatish
            </span>
          </div>
        </Link>

        {/* Naklit Skani (OCR) */}
        <Link
          to="/m/scan"
          className="flex flex-col justify-between rounded-2xl bg-rose-50/70 p-4 border border-rose-100 hover:border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <ScanLine size={24} className="text-rose-600 dark:text-rose-400" />
            <span className="text-sm text-rose-500 font-bold">→</span>
          </div>
          <div className="mt-3">
            <span className="block font-black text-base text-rose-950 dark:text-rose-100">
              Naklit Skani
            </span>
            <span className="block text-xs font-medium text-rose-700/80 dark:text-rose-300/80">
              Kamera bilan o‘qish
            </span>
          </div>
        </Link>

        {/* Mijozlar Ro'yxati */}
        <Link
          to="/m/clients"
          className="flex flex-col justify-between rounded-2xl bg-cyan-50/70 p-4 border border-cyan-100 hover:border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900/30 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <Store size={24} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-sm text-cyan-500 font-bold">→</span>
          </div>
          <div className="mt-3">
            <span className="block font-black text-base text-cyan-950 dark:text-cyan-100">
              Mijozlar
            </span>
            <span className="block text-xs font-medium text-cyan-700/80 dark:text-cyan-300/80">
              Do‘konlar & qarzlar
            </span>
          </div>
        </Link>

        {/* Boshlang'ich Qoldiq */}
        <Link
          to="/m/opening-stock"
          className="col-span-2 flex items-center justify-between rounded-2xl bg-gray-50 p-3.5 border border-gray-200 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3">
            <ClipboardPen size={20} className="text-gray-500" />
            <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
              Boshlang‘ich Qoldiqni Kiritish
            </span>
          </div>
          <span className="text-xs text-gray-400 font-bold">→</span>
        </Link>
      </div>

      {/* 4. Kam Qolgan Mahsulotlar (Svetofor qoidasi) */}
      {(low.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertTriangle size={15} />
            <span>Tugayotgan mahsulotlar ({low.data?.length} ta)</span>
          </div>
          <div className="divide-y divide-gray-100 rounded-2xl bg-white shadow-xs border border-rose-100 dark:divide-gray-800 dark:border-rose-950/30 dark:bg-gray-900">
            {low.data?.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 text-xs"
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                  {s.product_name}
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {s.quantity} ta qoldi
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Yordam */}
      <Link
        to="/m/help"
        className="flex items-center justify-center gap-2 rounded-2xl bg-white p-3 text-center text-xs font-semibold text-gray-500 shadow-xs border border-gray-100 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:hover:text-gray-200 transition"
      >
        <BookOpen size={16} aria-hidden />
        <span>Ombor & Tarqatuvchi yo‘riqnomasi</span>
      </Link>
    </div>
  );
}
