import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Fuel,
  Package,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { extractApiError } from '@/shared/api/client';
import { staffApi } from '@/shared/api/users';
import { roleLabel } from '@/shared/lib/labels';
import {
  USER_FEATURE_PERMISSIONS,
  USER_FEATURE_PERMISSION_LABELS,
  type UserFeaturePermission,
} from '@/shared/lib/permissions';
import { useAuthStore } from '@/shared/store/authStore';

const PERMISSION_ICONS: Record<UserFeaturePermission, typeof Package> = {
  can_receive_stock: Package,
  can_take_orders: ShoppingCart,
  can_make_sales: Truck,
  can_sell_on_debt: CreditCard,
  can_collect_debts: DollarSign,
  can_record_expenses: Fuel,
  can_see_warehouse_stock: Boxes,
  can_scan_invoices: ScanLine,
};

export function StaffPermissionsMatrix(): ReactElement {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string } | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff-matrix'],
    queryFn: () => staffApi.list({ page_size: 200 }),
  });

  const staffList = useMemo(
    () => staffQuery.data?.results ?? [],
    [staffQuery.data?.results],
  );

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q)
    );
  }, [staffList, search]);

  const selectedUser = useMemo(() => {
    if (selectedUserId) {
      const found = staffList.find((u) => u.id === selectedUserId);
      if (found) return found;
    }
    return filteredStaff[0] ?? null;
  }, [selectedUserId, staffList, filteredStaff]);

  const updateMutation = useMutation({
    mutationFn: async ({
      userId,
      field,
      value,
    }: {
      userId: string;
      field: UserFeaturePermission;
      value: boolean;
    }) => {
      return staffApi.update(userId, { [field]: value });
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['staff-matrix'] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
      const label = USER_FEATURE_PERMISSION_LABELS[variables.field].label;
      const statusText = variables.value ? 'yoqildi' : "o'chirildi";
      setFeedback({
        id: `${variables.userId}-${variables.field}`,
        msg: `«${label}» ${statusText}`,
      });
      window.setTimeout(() => setFeedback(null), 3500);
    },
  });

  const isBypassed =
    selectedUser?.role === 'SUPER_ADMIN' || selectedUser?.role === 'MANAGER';

  return (
    <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-brand/10 p-2 text-brand">
            <ShieldCheck size={22} aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              Xodimlar Ruxsatlari va Imkoniyatlari Boshqaruvi
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Har bir xodimga o‘z profilida ruxsat etilgan vazifalarni belgilash (tovar kirim,
              buyurtma, tarqatish, qarzga berish, pul undirish va h.k.)
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs font-medium text-success transition-all">
          <CheckCircle2 size={16} />
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Xodimlarni qidirish va tanlash */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chap ustun: Xodimlar ro'yxati */}
        <div className="space-y-2 lg:border-r lg:border-gray-100 lg:pr-4 dark:border-gray-800">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-2.5 top-2.5 text-gray-400"
              aria-hidden
            />
            <input
              type="text"
              className="field pl-8 text-xs"
              placeholder="Xodimni qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-xs">
            {filteredStaff.length === 0 ? (
              <p className="p-3 text-center text-gray-400">Xodim topilmadi</p>
            ) : (
              filteredStaff.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-brand text-white font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold truncate">{u.full_name}</div>
                      <div
                        className={`text-[11px] ${
                          isSelected ? 'text-white/80' : 'text-gray-400'
                        }`}
                      >
                        {u.phone} • {roleLabel(u.role)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* O'ng ustun: Tanlangan xodim ruxsatlari */}
        <div className="lg:col-span-2 space-y-3">
          {selectedUser ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 font-bold text-brand">
                    {selectedUser.full_name[0] ?? 'X'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{selectedUser.full_name}</div>
                    <div className="text-xs text-gray-500">
                      {selectedUser.phone} | <span className="font-medium">{roleLabel(selectedUser.role)}</span>
                    </div>
                  </div>
                </div>

                {isBypassed && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Menejer / Superuser — Barcha huquqlar ochiq
                  </span>
                )}
              </div>

              {isBypassed && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Ushbu foydalanuvchi ma’muriy rolga ega bo‘lgani uchun xavfsizlik qoidalariga
                  ko‘ra barcha operatsiyalarni cheklovsiz bajarishi mumkin.
                </p>
              )}

              {/* 8 ta Ruxsat togglelari */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {USER_FEATURE_PERMISSIONS.map((perm) => {
                  const meta = USER_FEATURE_PERMISSION_LABELS[perm];
                  const Icon = PERMISSION_ICONS[perm];
                  const isChecked = isBypassed
                    ? true
                    : Boolean(selectedUser.permissions?.[perm] ?? selectedUser[perm]);
                  const isPending =
                    updateMutation.isPending &&
                    updateMutation.variables?.userId === selectedUser.id &&
                    updateMutation.variables?.field === perm;

                  return (
                    <div
                      key={perm}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3 shadow-xs dark:border-gray-800 dark:bg-gray-800/30"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 rounded-md bg-gray-100 p-1.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          <Icon size={16} aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {meta.label}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isChecked}
                        aria-label={meta.label}
                        disabled={isBypassed || !isSuperAdmin || isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            userId: selectedUser.id,
                            field: perm,
                            value: !isChecked,
                          })
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                          isChecked ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {updateMutation.isError && (
                <p className="rounded-lg bg-danger/10 p-2 text-xs text-danger">
                  {extractApiError(updateMutation.error)}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Users size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Ruxsatlarni ko‘rish va o‘zgartirish uchun xodimni tanlang</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
