import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { catalogApi } from '@/shared/api/catalog';
import { AmountInput } from '@/shared/components/AmountInput';
import { applyServerErrors } from '@/shared/lib/formErrors';
import { money, plainQty } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/toast';
import { useAuthStore } from '@/shared/store/authStore';
import type { Brand, Category, Product, ProductInput, Unit } from '@/shared/types/catalog';

import { ProductImages } from './ProductImages';

interface Props {
  product: Product | null;
  onDone: () => void;
}

const PRICE_KEYS = [
  'cost_price',
  'order_commission_rate',
  'delivery_commission_rate',
] as const;

export function ProductForm({ product, onDone }: Props): ReactElement {
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.categories({ page_size: 200 }),
  });
  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => catalogApi.units({ page_size: 200 }),
  });
  const brands = useQuery({
    queryKey: ['brands'],
    queryFn: () => catalogApi.brands({ page_size: 200 }),
  });
  const otherProducts = useQuery({
    queryKey: ['products-bonus-select'],
    queryFn: () => catalogApi.products({ page_size: 200 }),
  });

  // Forma ma'lumotnomalar kelgandan keyin mount qilinadi: aks holda select'da hali
  // option yo'qligida defaultValue qo'yilmay qoladi va birlik/brend bo'sh ko'rinadi.
  if (categories.isError || units.isError || brands.isError) {
    return (
      <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
        Ma'lumotnomalarni yuklab bo'lmadi. Oynani yopib, qayta oching.
      </p>
    );
  }
  if (!categories.data || !units.data || !brands.data) {
    return <p className="py-6 text-center text-sm text-gray-500">Yuklanmoqda…</p>;
  }
  return (
    <ProductFormFields
      product={product}
      onDone={onDone}
      categories={categories.data.results}
      units={units.data.results}
      brands={brands.data.results}
      otherProducts={otherProducts.data?.results ?? []}
    />
  );
}

interface FieldsProps extends Props {
  categories: Category[];
  units: Unit[];
  brands: Brand[];
  otherProducts: Product[];
}

function ProductFormFields({
  product,
  onDone,
  categories,
  units,
  brands,
  otherProducts,
}: FieldsProps): ReactElement {
  const qc = useQueryClient();
  const toast = useToast();
  const role = useAuthStore((s) => s.user?.role);
  const canEditPrice = !product || role === 'SUPER_ADMIN';
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { register, control, handleSubmit, setError, formState, watch } = useForm<ProductInput>({
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          brand: product.brand ?? '',
          unit: product.unit,
          cost_price: product.cost_price,
          pack_quantity: plainQty(product.pack_quantity),
          package_type: product.package_type || '',
          order_commission_rate: product.order_commission_rate || '0',
          delivery_commission_rate: product.delivery_commission_rate || '0',
          has_bonus: product.has_bonus || false,
          bonus_trigger_qty: plainQty(product.bonus_trigger_qty || '0'),
          bonus_reward_qty: plainQty(product.bonus_reward_qty || '0'),
          bonus_product: product.bonus_product || '',
          track_variance: product.track_variance || false,
          min_stock_alert: plainQty(product.min_stock_alert),
          is_active: product.is_active,
        }
      : {
          is_active: true,
          pack_quantity: '1',
          package_type: '',
          order_commission_rate: '0',
          delivery_commission_rate: '0',
          has_bonus: false,
          bonus_trigger_qty: '0',
          bonus_reward_qty: '0',
          bonus_product: '',
          track_variance: false,
        },
  });

  const mutation = useMutation({
    mutationFn: (values: ProductInput) => {
      const body: ProductInput = {
        ...values,
        brand: values.brand || null,
        bonus_product: values.bonus_product || null,
      };
      if (product && !canEditPrice) {
        for (const k of PRICE_KEYS) delete body[k];
      }
      if (!body.min_stock_alert) {
        delete body.min_stock_alert;
      }
      return product
        ? catalogApi.updateProduct(product.id, body)
        : catalogApi.createProduct(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      toast.push({ kind: 'success', title: 'Mahsulot saqlandi' });
      onDone();
    },
    onMutate: () => setGeneralError(null),
    onError: (err) => setGeneralError(applyServerErrors(err, setError)),
  });

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit((v) => mutation.mutate(v))(e);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block space-y-1">
          <span className="text-sm font-medium">Nomi *</span>
          <input className="field" {...register('name', { required: 'Nomini kiriting' })} />
          {formState.errors.name?.message && (
            <span className="text-xs text-danger">{formState.errors.name.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">SKU *</span>
          <input className="field" {...register('sku', { required: 'SKU kiriting' })} />
          {formState.errors.sku?.message && (
            <span className="text-xs text-danger">{formState.errors.sku.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Shtrix-kod</span>
          <input className="field" {...register('barcode')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kategoriya *</span>
          <select
            className="field"
            {...register('category', { required: 'Kategoriyani tanlang' })}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {formState.errors.category?.message && (
            <span className="text-xs text-danger">{formState.errors.category.message}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">O'lchov birligi *</span>
          <select
            className="field"
            {...register('unit', { required: "O'lchov birligini tanlang" })}
          >
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.short_name}
              </option>
            ))}
          </select>
          {formState.errors.unit?.message && (
            <span className="text-xs text-danger">{formState.errors.unit.message}</span>
          )}
        </label>
        <label className="col-span-2 block space-y-1">
          <span className="text-sm font-medium">Brend</span>
          <select className="field" {...register('brand')}>
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset
        className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
        disabled={!canEditPrice}
      >
        <legend className="px-1 text-xs text-gray-500">
          Narx {canEditPrice ? '' : '(faqat SUPER_ADMIN)'}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Tannarx *</span>
            <Controller
              name="cost_price"
              control={control}
              render={({ field }) => (
                <AmountInput
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  showWords={false}
                  disabled={!canEditPrice}
                />
              )}
            />
            {formState.errors.cost_price?.message && (
              <span className="text-xs text-danger">{formState.errors.cost_price.message}</span>
            )}
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" {...register('track_variance')} />
            <span className="text-sm">Tannarxdan farqni (Kamomad / Ortiqcha) hisobotda kuzatish</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <legend className="px-1 text-xs text-gray-500">
          Oylik maosh uchun komissiya foizlari (tovar bo‘yicha)
        </legend>
        <label className="block space-y-1">
          <span className="text-sm">Zakaz oluvchi komissiyasi (%)</span>
          <input
            className="field"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('order_commission_rate')}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Tarqatuvchi (yetkazish) komissiyasi (%)</span>
          <input
            className="field"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('delivery_commission_rate')}
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <legend className="px-1 text-xs text-gray-500">Aksiya va Bonus tizimi</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('has_bonus')} />
          <span className="text-sm font-medium">Ushbu tovar uchun bonus berish</span>
        </label>
        {watch('has_bonus') && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <label className="block space-y-1">
              <span className="text-sm">Har nechtaga (xarid miqdori)</span>
              <input
                className="field"
                type="number"
                step="1"
                min="1"
                placeholder="masalan: 10"
                {...register('bonus_trigger_qty')}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Qo‘shiladigan bonus soni</span>
              <input
                className="field"
                type="number"
                step="1"
                min="1"
                placeholder="masalan: 1"
                {...register('bonus_reward_qty')}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">Bonus tovar</span>
              <select className="field" {...register('bonus_product')}>
                <option value="">Aynan shu tovarning o‘zidan</option>
                {otherProducts
                  .filter((p) => !product || p.id !== product.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      {!product && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800">
          Boshlang'ich qoldiqni saqlangandan keyin «Boshlang'ich qoldiqlar»
          bo'limidan kiritasiz.
        </p>
      )}

      {(() => {
        const selectedUnitId = watch('unit');
        const selectedUnit = units.find((u) => u.id === selectedUnitId);
        const costPrice = watch('cost_price');
        const packQuantity = watch('pack_quantity');
        const packQtyNum = parseInt(String(packQuantity || '0'), 10);
        const costPriceNum = Number(costPrice || 0);
        const boxCost = packQtyNum * costPriceNum;
        const packageType = watch('package_type') || (
          (selectedUnit?.name || selectedUnit?.short_name || '').toLowerCase().includes('kg') ? 'xalta' : 'quti'
        );

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-3">
              <label className="block space-y-1">
                <span className="text-sm">Qadoq turi</span>
                <input
                  className="field"
                  placeholder="masalan: qop, karopka, pachka"
                  {...register('package_type')}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Qadoq soni</span>
                <input
                  className="field"
                  type="number"
                  step="1"
                  min="1"
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === ',') e.preventDefault();
                  }}
                  {...register('pack_quantity', {
                    validate: (v) =>
                      !v || Number.isInteger(Number(v)) || 'Butun son kiriting',
                  })}
                />
                {formState.errors.pack_quantity?.message && (
                  <span className="text-xs text-danger">
                    {formState.errors.pack_quantity.message}
                  </span>
                )}
              </label>
              <label className="block space-y-1">
                <span className="text-sm">Kam qoldiq</span>
                <input
                  className="field"
                  type="number"
                  step="1"
                  min="0"
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === ',') e.preventDefault();
                  }}
                  {...register('min_stock_alert', {
                    validate: (v) =>
                      !v || Number.isInteger(Number(v)) || 'Butun son kiriting',
                  })}
                />
                {formState.errors.min_stock_alert?.message && (
                  <span className="text-xs text-danger">
                    {formState.errors.min_stock_alert.message}
                  </span>
                )}
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" {...register('is_active')} />
                <span className="text-sm">Faol</span>
              </label>
            </div>

            {packQtyNum > 0 && costPriceNum > 0 && (
              <div className="rounded-lg border border-brand/30 bg-brand/5 p-2.5 text-xs text-brand-700 dark:text-brand-300">
                <span className="font-semibold">
                  📦 1 {packageType} narxi:
                </span>{' '}
                <span className="text-sm font-bold text-brand">{money(boxCost)}</span>{' '}
                <span className="text-gray-500">
                  ({packQtyNum} {selectedUnit?.short_name || 'dona'} × {money(costPriceNum)})
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {product ? (
        <ProductImages productId={product.id} />
      ) : (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800">
          Rasmlarni mahsulot saqlangandan keyin qo‘shasiz.
        </p>
      )}

      {generalError && (
        <p className="whitespace-pre-line rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="btn px-4">
          Bekor
        </button>
        <button
          type="submit"
          className="btn-brand px-6"
          disabled={mutation.isPending || formState.isSubmitting}
        >
          Saqlash
        </button>
      </div>
    </form>
  );
}
