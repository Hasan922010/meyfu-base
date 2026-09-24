import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { catalogApi } from '@/shared/api/catalog';
import { AmountInput } from '@/shared/components/AmountInput';
import { applyServerErrors } from '@/shared/lib/formErrors';
import { useAuthStore } from '@/shared/store/authStore';
import type { Brand, Category, Product, ProductInput, Unit } from '@/shared/types/catalog';

import { ProductImages } from './ProductImages';

interface Props {
  product: Product | null;
  onDone: () => void;
}

const PRICE_KEYS = [
  'cost_price',
  'wholesale_price',
  'retail_price',
  'min_price',
  'commission_percent',
] as const;

const PRICE_FIELDS = [
  { name: 'cost_price', label: 'Tannarx' },
  { name: 'wholesale_price', label: 'Optom narx' },
  { name: 'retail_price', label: 'Chakana narx' },
  { name: 'min_price', label: 'Minimal narx' },
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
    />
  );
}

interface FieldsProps extends Props {
  categories: Category[];
  units: Unit[];
  brands: Brand[];
}

function ProductFormFields({
  product,
  onDone,
  categories,
  units,
  brands,
}: FieldsProps): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEditPrice = !product || role === 'SUPER_ADMIN';
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { register, control, handleSubmit, setError, formState } = useForm<ProductInput>({
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          brand: product.brand ?? '',
          unit: product.unit,
          cost_price: product.cost_price,
          wholesale_price: product.wholesale_price,
          retail_price: product.retail_price,
          min_price: product.min_price,
          pack_quantity: product.pack_quantity,
          commission_percent: product.commission_percent,
          min_stock_alert: product.min_stock_alert,
          is_active: product.is_active,
        }
      : { is_active: true, pack_quantity: '1' },
  });

  const mutation = useMutation({
    mutationFn: (values: ProductInput) => {
      const body: ProductInput = { ...values, brand: values.brand || null };
      if (product && !canEditPrice) {
        for (const k of PRICE_KEYS) delete body[k];
      }
      // Ixtiyoriy raqamli maydon — bo'sh qoldirilsa backendga umuman yubormaymiz
      // (bo'sh satr "" "raqam emas" xatosiga sabab bo'ladi, chunki bu register()
      // orqali ulangan, AmountInput'lardan farqli ravishda ular tegilmasa
      // `undefined` bo'lib avtomatik tushib qoladi).
      if (!body.min_stock_alert) {
        delete body.min_stock_alert;
      }
      return product
        ? catalogApi.updateProduct(product.id, body)
        : catalogApi.createProduct(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
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
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
        disabled={!canEditPrice}
      >
        <legend className="px-1 text-xs text-gray-500">
          Narxlar {canEditPrice ? '' : '(faqat SUPER_ADMIN)'}
        </legend>
        {PRICE_FIELDS.map(({ name, label }) => (
          <label key={name} className="block space-y-1">
            <span className="text-sm">{label}</span>
            <Controller
              name={name}
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
            {formState.errors[name]?.message && (
              <span className="text-xs text-danger">{formState.errors[name].message}</span>
            )}
          </label>
        ))}
      </fieldset>

      {!product && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800">
          Boshlang'ich qoldiqni saqlangandan keyin «Boshlang'ich qoldiqlar»
          bo'limidan kiritasiz.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-1">
          <span className="text-sm">Qadoq soni</span>
          <input className="field" type="number" step="0.001" {...register('pack_quantity')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Kam qoldiq</span>
          <input className="field" type="number" step="0.001" {...register('min_stock_alert')} />
        </label>
        <label className="flex items-center gap-2 pt-6">
          <input type="checkbox" {...register('is_active')} />
          <span className="text-sm">Faol</span>
        </label>
      </div>

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
