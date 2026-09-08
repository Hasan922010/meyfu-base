import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

import { extractApiError } from '@/shared/api/client';
import { staffApi, type StaffInput } from '@/shared/api/users';
import type { Role, User } from '@/shared/types/api';

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'DISTRIBUTOR', label: 'Tarqatuvchi' },
  { value: 'WAREHOUSE', label: 'Omborchi' },
  { value: 'MANAGER', label: 'Menejer' },
  { value: 'ACCOUNTANT', label: 'Buxgalter' },
  { value: 'SUPER_ADMIN', label: 'Super admin' },
];

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

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: staff
      ? {
          phone: staff.phone,
          full_name: staff.full_name,
          role: staff.role,
          passport_series: staff.passport_series ?? '',
          address: staff.address ?? '',
          hire_date: staff.hire_date ?? '',
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
      : { role: 'DISTRIBUTOR' },
  });

  const role = watch('role');

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body: Partial<StaffInput> = {
        full_name: v.full_name,
        role: v.role,
        passport_series: v.passport_series || '',
        address: v.address || '',
        hire_date: v.hire_date || null,
      };
      if (!staff) body.phone = v.phone;
      if (v.password) body.password = v.password;
      if (v.role === 'DISTRIBUTOR') {
        body.distributor_profile = {
          commission_percent: v.p_commission_percent || '0',
          order_commission_percent: v.p_order_commission_percent || '0',
          delivery_commission_percent: v.p_delivery_commission_percent || '0',
          base_salary: v.p_base_salary || '0',
          monthly_plan: v.p_monthly_plan || '0',
          debt_limit: v.p_debt_limit || '0',
          daily_expense_limit: v.p_daily_expense_limit || '0',
          vehicle_number: v.p_vehicle_number || '',
          can_sell_below_price: Boolean(v.p_can_sell_below_price),
        };
      }
      return staff
        ? staffApi.update(staff.id, body)
        : staffApi.create(body as StaffInput);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff'] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)}
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
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">F.I.SH. *</span>
          <input className="field" {...register('full_name', { required: true })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Rol *</span>
          <select className="field" {...register('role')}>
            {ROLES.map((r) => (
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
      </div>

      {role === 'DISTRIBUTOR' && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Tarqatuvchi profili
          </p>
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
              <span className="text-sm">Asosiy maosh</span>
              <input
                className="field"
                type="number"
                step="0.01"
                {...register('p_base_salary')}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Oylik reja</span>
              <input
                className="field"
                type="number"
                step="0.01"
                {...register('p_monthly_plan')}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Qarz limiti</span>
              <input
                className="field"
                type="number"
                step="0.01"
                {...register('p_debt_limit')}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Kunlik xarajat limiti</span>
              <input
                className="field"
                type="number"
                step="0.01"
                {...register('p_daily_expense_limit')}
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

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
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
