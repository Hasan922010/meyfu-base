import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { login } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { useAuthStore } from '@/shared/store/authStore';

interface LocationState {
  from?: string;
}

function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  // Backslashes are normalized to slashes by some URL parsers and can turn an
  // apparently local path into an external redirect.
  if (value.includes('\\')) return '/';
  return value;
}

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data);
      const state = location.state as LocationState | null;
      void navigate(safeRedirectPath(state?.from), { replace: true });
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
        <div className="flex justify-end">
          <LanguageSwitch />
        </div>

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
            onChange={(e) => {
              setPhone(e.target.value);
              mutation.reset();
            }}
            autoFocus
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('auth.password')}</span>
          <div className="relative">
            <input
              className="field pr-10"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                mutation.reset();
              }}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute inset-y-0 right-0 px-3 text-gray-500"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {mutation.isError && (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {extractApiError(mutation.error)}
          </p>
        )}

        <button
          type="submit"
          className="btn-brand w-full"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending}
        >
          {mutation.isPending ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        <p className="text-center text-xs text-gray-400">{t('auth.contactAdmin')}</p>
      </form>
    </div>
  );
}
