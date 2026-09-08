import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

import { catalogApi } from '@/shared/api/catalog';
import { extractApiError } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/authStore';
import type { Product, ProductInput } from '@/shared/types/catalog';

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

export function ProductForm({ product, onDone }: Props): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEditPrice = !product || role === 'SUPER_ADMIN';

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

  const { register, handleSubmit, formState } = useForm<ProductInput>({
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
      return product
        ? catalogApi.updateProduct(product.id, body)
        : catalogApi.createProduct(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      onDone();
    },
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
          <input className="field" {...register('name', { required: true })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">SKU *</span>
          <input className="field" {...register('sku', { required: true })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Shtrix-kod</span>
          <input className="field" {...register('barcode')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kategoriya *</span>
          <select className="field" {...register('category', { required: true })}>
            <option value="">—</option>
            {categories.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">O'lchov birligi *</span>
          <select className="field" {...register('unit', { required: true })}>
            <option value="">—</option>
            {units.data?.results.map((u) => (
              <option key={u.id} value={u.id}>
                {u.short_name}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block space-y-1">
          <span className="text-sm font-medium">Brend</span>
          <select className="field" {...register('brand')}>
            <option value="">—</option>
            {brands.data?.results.map((b) => (
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
        <label className="block space-y-1">
          <span className="text-sm">Tannarx</span>
          <input className="field" type="number" step="0.01" {...register('cost_price')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Optom narx</span>
          <input className="field" type="number" step="0.01" {...register('wholesale_price')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Chakana narx</span>
          <input className="field" type="number" step="0.01" {...register('retail_price')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Minimal narx</span>
          <input className="field" type="number" step="0.01" {...register('min_price')} />
        </label>
      </fieldset>

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

      {mutation.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {extractApiError(mutation.error)}
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
