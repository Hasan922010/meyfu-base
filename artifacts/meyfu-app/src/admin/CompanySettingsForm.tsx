import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';

import { extractApiError } from '@/shared/api/client';
import {
  companyApi,
  type CompanySettingsInput,
} from '@/shared/api/company';
import { DataState } from '@/shared/components/DataState';
import { useAuthStore } from '@/shared/store/authStore';

type FormState = {
  name: string;
  legal_name: string;
  inn: string;
  address: string;
  phone: string;
  bank_details: string;
  director_name: string;
};

const EMPTY: FormState = {
  name: '',
  legal_name: '',
  inn: '',
  address: '',
  phone: '',
  bank_details: '',
  director_name: '',
};

export function CompanySettingsForm(): ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === 'SUPER_ADMIN';

  const query = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companyApi.get(),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [stamp, setStamp] = useState<File | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.data) {
      setForm({
        name: query.data.name,
        legal_name: query.data.legal_name,
        inn: query.data.inn,
        address: query.data.address,
        phone: query.data.phone,
        bank_details: query.data.bank_details,
        director_name: query.data.director_name,
      });
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      // Logo/muhr — kichik fayllar, bir marta; siqmaymiz (muhr shaffofligi saqlansin)
      const body: CompanySettingsInput = { ...form };
      if (logo) body.logo = logo;
      if (stamp) body.stamp = stamp;
      return companyApi.update(body);
    },
    onSuccess: () => {
      setLogo(null);
      setStamp(null);
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['company-settings'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  function field(key: keyof FormState, label: string, textarea = false): ReactElement {
    return (
      <label className="block space-y-1">
        <span className="text-sm font-medium">{label}</span>
        {textarea ? (
          <textarea
            className="field min-h-[70px]"
            disabled={!canEdit}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        ) : (
          <input
            className="field"
            disabled={!canEdit}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        )}
      </label>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kompaniya rekvizitlari</h2>
        {!canEdit && (
          <span className="text-xs text-gray-400">faqat ko‘rish (SUPER_ADMIN)</span>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Nakladnoy, yuklama va chek PDF‘larida sarlavha va muhr sifatida ishlatiladi.
      </p>

      <DataState isLoading={query.isLoading} isError={query.isError}>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', 'Nomi')}
          {field('legal_name', "To‘liq yuridik nomi")}
          {field('inn', 'STIR / INN')}
          {field('phone', 'Telefon')}
          <div className="sm:col-span-2">{field('address', 'Manzil')}</div>
          {field('director_name', 'Rahbar F.I.SH.')}
          <div className="sm:col-span-2">
            {field('bank_details', 'Bank rekvizitlari', true)}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AssetRow
            label="Logotip"
            current={query.data?.logo ?? null}
            picked={logo}
            inputRef={logoRef}
            disabled={!canEdit}
            onPick={setLogo}
          />
          <AssetRow
            label="Muhr (PNG, shaffof fon)"
            current={query.data?.stamp ?? null}
            picked={stamp}
            inputRef={stampRef}
            disabled={!canEdit}
            onPick={setStamp}
          />
        </div>

        {save.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(save.error)}
          </p>
        )}
        {saved && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            Saqlandi.
          </p>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <button
              className="btn-brand px-6"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>
        )}
      </DataState>
    </div>
  );
}

function AssetRow({
  label,
  current,
  picked,
  inputRef,
  disabled,
  onPick,
}: {
  label: string;
  current: string | null;
  picked: File | null;
  inputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
  onPick: (f: File | null) => void;
}): ReactElement {
  const preview = picked ? URL.createObjectURL(picked) : current;
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          {preview ? (
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-gray-400">yo‘q</span>
          )}
        </div>
        {!disabled && (
          <>
            <button
              type="button"
              className="btn px-3 py-1.5 text-sm"
              onClick={() => inputRef.current?.click()}
            >
              {picked ? 'Boshqa fayl' : 'Yuklash'}
            </button>
            {picked && (
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => onPick(null)}
              >
                bekor
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </>
        )}
      </div>
    </div>
  );
}
