import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { extractApiError } from '@/shared/api/client';
import { staffApi, type StaffInput } from '@/shared/api/users';
import { warehouseApi } from '@/shared/api/warehouse';
import { AmountInput } from '@/shared/components/AmountInput';
import { SignedAmountInput } from '@/shared/components/SignedAmountInput';
import { applyServerFieldErrors } from '@/shared/lib/formErrors';
import { useAuthStore } from '@/shared/store/authStore';
import type { Role, User } from '@/shared/types/api';

const PROFILE_FIELD_MAP: Record<string, string> = {
  'distributor_profile.commission_percent': 'p_commission_percent',
  'distributor_profile.order_commission_percent': 'p_order_commission_percent',
  'distributor_profile.delivery_commission_percent': 'p_delivery_commission_percent',
  'distributor_profile.base_salary': 'p_base_salary',
  'distributor_profile.monthly_plan': 'p_monthly_plan',
  'distributor_profile.debt_limit': 'p_debt_limit',
  'distributor_profile.daily_expense_limit': 'p_daily_expense_limit',
  'distributor_profile.vehicle_number': 'p_vehicle_number',
  opening_balance: 'p_opening_balance',
};

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'DISTRIBUTOR', label: 'Tarqatuvchi' },
  { value: 'ORDER_TAKER', label: 'Zakaz oluvchi' },
  { value: 'WAREHOUSE', label: 'Omborchi' },
  { value: 'MANAGER', label: 'Menejer' },
  { value: 'BRANCH_MANAGER', label: 'Filial rahbari' },
  { value: 'ACCOUNTANT', label: 'Buxgalter' },
  { value: 'SUPER_ADMIN', label: 'Super admin' },
];

/** Filial rahbari qo'sha oladigan rollar — backend core/branch.py BRANCH_STAFF_ROLES */
const BRANCH_STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  'DISTRIBUTOR', 'ORDER_TAKER', 'WAREHOUSE', 'ACCOUNTANT',
]);

interface FormValues extends StaffInput {
  p_commission_percent?: string;
  p_order_commission_percent?: string;
  p_delivery_commission_percent?: string;
  p_base_salary?: string;
  p_monthly_plan?: string;
  p_debt_limit?: string;
  p_daily_expense_limit?: string;
  p_vehicle_number?: string;
  p_can_sell_below_price?: boolean;
  /** Faqat yaratishda: dastlabki hisob-kitob (ishorali) */
  p_opening_balance?: string;
}

export function StaffForm({
  staff,
  onDone,
}: {
  staff: User | null;
  onDone: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const pr = staff?.distributor_profile ?? null;

  const [serverError, setServerError] = useState<string>('');
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: staff
      ? {
          phone: staff.phone,
          full_name: staff.full_name,
          role: staff.role,
          passport_series: staff.passport_series ?? '',
          address: staff.address ?? '',
          hire_date: staff.hire_date ?? '',
          warehouse: staff.warehouse ?? '',
          p_commission_percent: pr?.commission_percent ?? '0',
          p_order_commission_percent: pr?.order_commission_percent ?? '0',
          p_delivery_commission_percent: pr?.delivery_commission_percent ?? '0',
          p_base_salary: pr?.base_salary ?? '0',
          p_monthly_plan: pr?.monthly_plan ?? '0',
          p_debt_limit: pr?.debt_limit ?? '0',
          p_daily_expense_limit: pr?.daily_expense_limit ?? '0',
          p_vehicle_number: pr?.vehicle_number ?? '',
          p_can_sell_below_price: pr?.can_sell_below_price ?? false,
        }
      : { role: 'DISTRIBUTOR', p_base_salary: '0' },
  });

  const role = watch('role');
  const creatorRole = useAuthStore((s) => s.user?.role);
  // Filial rahbari: xodim avtomatik o'z filialiga qo'shiladi (server majburlaydi)
  const byBranchManager = creatorRole === 'BRANCH_MANAGER';
  const roleOptions = byBranchManager
    ? ROLES.filter((r) => BRANCH_STAFF_ROLES.has(r.value) || r.value === staff?.role)
    : ROLES;
  const needsBranch = role === 'BRANCH_MANAGER';
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseApi.warehouses({ page_size: 200 }),
    enabled: !byBranchManager,
  });
  const warehouseOptions = (warehouses.data?.results ?? []).filter(
    (w) => !needsBranch || w.is_branch,
  );

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body: Partial<StaffInput> = {
        full_name: v.full_name,
        role: v.role,
        passport_series: v.passport_series || '',
        address: v.address || '',
        hire_date: v.hire_date || null,
        // Xodim filiali (bo'sh — markaz). Filial rahbari yuborsa — server o'z filialini qo'yadi
        ...(byBranchManager ? {} : { warehouse: v.warehouse || null }),
      };
      if (!staff) body.phone = v.phone;
      if (v.password) body.password = v.password;
      // Asosiy maosh — endi barcha rol turlari uchun (CLAUDE.md 6 — Maosh).
      // Qolgan (komissiya, mashina, qarz limiti) — faqat tarqatuvchiga xos.
      body.distributor_profile = {
        base_salary: v.p_base_salary || '0',
        ...(v.role === 'DISTRIBUTOR'
          ? {
              commission_percent: v.p_commission_percent || '0',
              order_commission_percent: v.p_order_commission_percent || '0',
              delivery_commission_percent: v.p_delivery_commission_percent || '0',
              monthly_plan: v.p_monthly_plan || '0',
              debt_limit: v.p_debt_limit || '0',
              daily_expense_limit: v.p_daily_expense_limit || '0',
              vehicle_number: v.p_vehicle_number || '',
              can_sell_below_price: Boolean(v.p_can_sell_below_price),
            }
          : v.role === 'ORDER_TAKER'
            ? { order_commission_percent: v.p_order_commission_percent || '0' }
            : {}),
      };
      if (!staff && v.p_opening_balance) {
        body.opening_balance = v.p_opening_balance;
      }
      return staff
        ? staffApi.update(staff.id, body)
        : staffApi.create(body as StaffInput);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
      onDone();
    },
    onError: (err) => {
      const leftover = applyServerFieldErrors(err, setError, PROFILE_FIELD_MAP);
      setServerError(leftover.join(' · ') || extractApiError(err));
    },
  });

  return (
    <form
      onSubmit={(e) =>
        void handleSubmit((v) => {
          setServerError('');
          mutation.mutate(v);
        })(e)
      }
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Telefon *</span>
          <input
            className="field"
            placeholder="+998 90 123 45 67"
            disabled={Boolean(staff)}
            {...register('phone', { required: !staff })}
          />
          {errors.phone?.message && (
            <span className="text-xs text-danger">{errors.phone.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">F.I.SH. *</span>
          <input className="field" {...register('full_name', { required: true })} />
          {errors.full_name?.message && (
            <span className="text-xs text-danger">{errors.full_name.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Rol *</span>
          <select className="field" {...register('role')}>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            {staff ? 'Yangi parol (bo’sh — o’zgarmaydi)' : 'Parol *'}
          </span>
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            {...register('password', { required: !staff, minLength: 8 })}
          />
          {errors.password?.message && (
            <span className="text-xs text-danger">{errors.password.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Passport seriyasi</span>
          <input className="field" {...register('passport_series')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Ishga kirgan sana</span>
          <input className="field" type="date" {...register('hire_date')} />
        </label>
        <label className="col-span-2 block space-y-1">
          <span className="text-sm font-medium">Manzil</span>
          <input className="field" {...register('address')} />
        </label>
        {!byBranchManager && (
          <label className="col-span-2 block space-y-1">
            <span className="text-sm font-medium">
              {needsBranch ? 'Filial *' : 'Filial / ombor'}
            </span>
            <select
              className="field"
              {...register('warehouse', { required: needsBranch })}
            >
              <option value="">
                {needsBranch ? '— Filialni tanlang' : '— Markaz (barcha filiallar)'}
              </option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <span className="block text-xs text-gray-500">
              Filialga biriktirilgan xodim faqat shu filial ma'lumotini ko'radi va
              o'z login-paroli bilan faqat o'z filialida ishlaydi.
            </span>
            {errors.warehouse && (
              <span className="text-xs text-danger">
                {errors.warehouse.message || 'Filial rahbariga filial biriktiring.'}
              </span>
            )}
          </label>
        )}
      </div>

      <div className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          Xodim profili (maosh)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm">Asosiy maosh</span>
            <Controller
              name="p_base_salary"
              control={control}
              render={({ field }) => (
                <AmountInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  showWords={false}
                />
              )}
            />
          </label>
          {!staff && (
            <label className="block space-y-1">
              <span className="text-sm">Boshlang'ich balans (ixtiyoriy)</span>
              <Controller
                name="p_opening_balance"
                control={control}
                render={({ field }) => (
                  <SignedAmountInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    positiveLabel="Xodimga berilgan (avans)"
                    negativeLabel="Xodimning qarzi"
                  />
                )}
              />
            </label>
          )}
        </div>

        {role === 'ORDER_TAKER' && (
          <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <p className="text-xs text-gray-500">
              Zakaz oluvchi faqat buyurtma oladi — marshrutni «Marshrutlar» bo‘limida biriktiring.
            </p>
            <label className="block space-y-1">
              <span className="text-sm">Zakaz olgani uchun %</span>
              <input
                className="field"
                type="number"
                step="0.01"
                {...register('p_order_commission_percent')}
              />
            </label>
          </div>
        )}

        {role === 'DISTRIBUTOR' && (
          <div className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <p className="text-xs text-gray-500">Tarqatuvchiga xos sozlamalar</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm">Zakaz olgani uchun %</span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  {...register('p_order_commission_percent')}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Yetkazib bergani uchun %</span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  {...register('p_delivery_commission_percent')}
                />
              </label>
              <label className="col-span-2 block space-y-1">
                <span className="text-sm text-gray-500">
                  Komissiya % (eski — yuqoridagi ikkitasi 0 bo'lsa ishlatiladi)
                </span>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  {...register('p_commission_percent')}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Oylik reja</span>
                <Controller
                  name="p_monthly_plan"
                  control={control}
                  render={({ field }) => (
                    <AmountInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      showWords={false}
                    />
                  )}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Qarz limiti</span>
                <Controller
                  name="p_debt_limit"
                  control={control}
                  render={({ field }) => (
                    <AmountInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      showWords={false}
                    />
                  )}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Kunlik xarajat limiti</span>
                <Controller
                  name="p_daily_expense_limit"
                  control={control}
                  render={({ field }) => (
                    <AmountInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      showWords={false}
                    />
                  )}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Mashina raqami</span>
                <input className="field" {...register('p_vehicle_number')} />
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('p_can_sell_below_price')} />
              <span className="text-sm">Minimal narxdan past sotishga ruxsat</span>
            </label>
          </div>
        )}
      </div>

      {mutation.isError && serverError && (
        <p className="whitespace-pre-line rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="btn px-4">
          Bekor
        </button>
        <button type="submit" className="btn-brand px-6" disabled={mutation.isPending}>
          Saqlash
        </button>
      </div>
    </form>
  );
}
