import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import type { Client, ClientInput } from '@/shared/types/clients';

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'SHOP', label: "Do'kon" },
  { value: 'MARKET', label: 'Bozor' },
  { value: 'SUPERMARKET', label: 'Supermarket' },
  { value: 'PHARMACY', label: 'Dorixona' },
  { value: 'OTHER', label: 'Boshqa' },
];

export function ClientForm({
  client,
  onDone,
}: {
  client: Client | null;
  onDone: () => void;
}): ReactElement {
  const qc = useQueryClient();
  const routes = useQuery({
    queryKey: ['routes'],
    queryFn: () => clientsApi.routes({ page_size: 200 }),
  });

  const { register, handleSubmit } = useForm<ClientInput>({
    defaultValues: client
      ? {
          name: client.name,
          owner_name: client.owner_name,
          phone: client.phone,
          phone2: client.phone2,
          address: client.address,
          route: client.route ?? '',
          client_type: client.client_type,
          debt_limit: client.debt_limit,
          inn: client.inn,
          is_blocked: client.is_blocked,
          note: client.note,
        }
      : { client_type: 'SHOP', is_blocked: false },
  });

  const mutation = useMutation({
    mutationFn: (values: ClientInput) => {
      const body: ClientInput = { ...values, route: values.route || null };
      return client
        ? clientsApi.update(client.id, body)
        : clientsApi.create(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
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
          <span className="text-sm font-medium">Do'kon nomi *</span>
          <input className="field" {...register('name', { required: true })} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Egasi</span>
          <input className="field" {...register('owner_name')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Turi</span>
          <select className="field" {...register('client_type')}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Telefon</span>
          <input className="field" {...register('phone')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Qo'shimcha telefon</span>
          <input className="field" {...register('phone2')} />
        </label>
        <label className="col-span-2 block space-y-1">
          <span className="text-sm font-medium">Manzil</span>
          <input className="field" {...register('address')} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Marshrut</span>
          <select className="field" {...register('route')}>
            <option value="">—</option>
            {routes.data?.results.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Qarz limiti</span>
          <input
            className="field"
            type="number"
            step="0.01"
            {...register('debt_limit')}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">INN / STIR</span>
          <input className="field" {...register('inn')} />
        </label>
        <label className="flex items-center gap-2 pt-6">
          <input type="checkbox" {...register('is_blocked')} />
          <span className="text-sm">Bloklangan (faqat naqd)</span>
        </label>
      </div>

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
          disabled={mutation.isPending}
        >
          Saqlash
        </button>
      </div>
    </form>
  );
}
