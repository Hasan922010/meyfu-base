import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { login } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/authStore';

interface LocationState {
  from?: string;
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data);
      const state = location.state as LocationState | null;
      navigate(state?.from ?? '/', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    mutation.mutate({ phone, password });
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand">{t('app.name')}</h1>
          <p className="text-sm text-gray-500">{t('app.tagline')}</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('auth.phone')}</span>
          <input
            className="field"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="+998901234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('auth.password')}</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {mutation.isError && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}

        <button type="submit" className="btn-brand w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </div>
  );
}
