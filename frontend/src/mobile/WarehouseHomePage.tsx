import { useQuery } from '@tanstack/react-query';
import { Boxes, PackagePlus, ScanLine, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { warehouseApi } from '@/shared/api/warehouse';
import { useAuthStore } from '@/shared/store/authStore';

const LINKS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/m/receive', label: 'Tovar qabuli', Icon: PackagePlus },
  { to: '/m/scan', label: 'Naklit skani', Icon: ScanLine },
  { to: '/m/stock', label: 'Ombor qoldig‘i', Icon: Boxes },
];

export function WarehouseHomePage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const low = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: () => warehouseApi.lowStock(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Assalomu alaykum,</h1>
        <p className="text-gray-500">{user?.full_name}</p>
      </div>

      <Link
        to="/m/receive"
        className="btn-brand flex w-full items-center justify-center gap-2 py-4 text-base"
      >
        <PackagePlus size={20} aria-hidden /> Tovar qabul qilish
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-4 text-center text-sm shadow-sm dark:bg-gray-900"
          >
            <l.Icon size={26} className="text-brand" aria-hidden />
            {l.label}
          </Link>
        ))}
      </div>

      {(low.data?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <div className="text-sm font-semibold text-danger">
            Kam qolgan mahsulotlar ({low.data?.length})
          </div>
          {low.data?.slice(0, 10).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-sm dark:bg-gray-900"
            >
              <span>{s.product_name}</span>
              <span className="font-semibold text-danger">{s.quantity}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
