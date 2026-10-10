import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';

import { db } from '@/offline/db';
import { extractApiError } from '@/shared/api/client';
import { clientsApi } from '@/shared/api/clients';
import { Modal } from '@/shared/components/Modal';
import { useToast } from '@/shared/lib/toast';
import type { Client, ClientInput, Route } from '@/shared/types/clients';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

export function NewClientModal({ open, onClose, onCreated }: Props): ReactElement {
  const qc = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('+998');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [routeId, setRouteId] = useState('');
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [locating, setLocating] = useState(false);

  // Faqat o'ziga biriktirilgan marshrutlar
  const routesQuery = useQuery({
    queryKey: ['routes', 'my'],
    queryFn: () => clientsApi.myRoutes(),
    enabled: open,
  });

  const routes: Route[] = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  useEffect(() => {
    if (routes.length === 1 && !routeId && routes[0]) {
      setRouteId(routes[0].id);
    }
  }, [routes, routeId]);

  function resetForm(): void {
    setName('');
    setOwnerName('');
    setPhone('+998');
    setPhone2('');
    setAddress('');
    setCoords(null);
    if (routes.length === 1 && routes[0]) setRouteId(routes[0].id);
    else setRouteId('');
  }

  function handleGetLocation(): void {
    if (!navigator.geolocation) {
      toast.push({ kind: 'danger', title: 'GPS qo‘llab-quvvatlanmaydi' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
        toast.push({ kind: 'success', title: 'Joylashuv aniqlandi' });
      },
      () => {
        setLocating(false);
        toast.push({ kind: 'danger', title: 'Joylashuvni aniqlab bo‘lmadi' });
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  const mutation = useMutation({
    mutationFn: async (payload: ClientInput) => {
      const created = await clientsApi.create(payload);
      // Lokal Dexie bazasiga ham qo'shamiz (offline/sync uchun)
      try {
        await db.clients.put({
          id: created.id,
          name: created.name,
          owner_name: created.owner_name,
          phone: created.phone,
          address: created.address,
          route: created.route,
          debt_limit: created.debt_limit,
          current_debt: created.current_debt,
          is_blocked: created.is_blocked,
        });
      } catch (err) {
        console.warn('Lokal mijoz keshiga yozilmadi:', err);
      }
      return created;
    },
    onSuccess: (newClient) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.push({ kind: 'success', title: 'Yangi mijoz qo‘shildi' });
      resetForm();
      onClose();
      onCreated?.(newClient);
    },
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!name.trim()) {
      toast.push({ kind: 'danger', title: 'Mijoz nomini kiriting' });
      return;
    }
    if (!phone.trim() || phone === '+998') {
      toast.push({ kind: 'danger', title: 'Telefon raqamini kiriting' });
      return;
    }
    if (!routeId) {
      toast.push({ kind: 'danger', title: 'Marshrutni tanlang' });
      return;
    }

    const payload: ClientInput = {
      name: name.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      phone2: phone2.trim(),
      address: address.trim(),
      route: routeId,
      latitude: coords ? coords.lat : null,
      longitude: coords ? coords.lng : null,
    };

    mutation.mutate(payload);
  }

  return (
    <Modal open={open} title="Yangi mijoz qo‘shish" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Do‘kon / Mijoz nomi *</span>
          <input
            className="field"
            placeholder="Masalan: Omad market"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Mas’ul shaxs (egasi)</span>
          <input
            className="field"
            placeholder="F.I.SH."
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Telefon *</span>
            <input
              className="field"
              type="tel"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Qo‘shimcha tel</span>
            <input
              className="field"
              type="tel"
              placeholder="+998931234567"
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Marshrut *</span>
          <select
            className="field"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            required
          >
            <option value="">— Marshrutni tanlang —</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Manzil / Mo‘ljal</span>
          <input
            className="field"
            placeholder="Ko‘cha, mo‘ljal"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800">
          <div className="text-xs text-gray-500">
            {coords ? `Joylashuv: ${coords.lat}, ${coords.lng}` : 'Joylashuv aniqlanmagan'}
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={locating}
            className="btn flex items-center gap-1 text-xs text-brand"
          >
            <MapPin size={14} aria-hidden />
            {locating ? 'Aniqlanmoqda…' : coords ? 'Qayta aniqlash' : '📍 Joylashuvni olish'}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn px-4">
            Bekor
          </button>
          <button type="submit" className="btn-brand px-6" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
