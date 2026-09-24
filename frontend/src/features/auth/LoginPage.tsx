import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { login } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';
import { authSelectors, useAuthStore } from '@/shared/store/authStore';

interface LocationState {
  from?: string;
}

type FieldErrors = { phone?: string; password?: string };

export function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore(authSelectors.isAuthenticated);

  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data);
      const state = location.state as LocationState | null;
      void navigate(state?.from ?? '/', { replace: true });
    },
  });

  // Kirgan foydalanuvchi login formasini qayta ko'rmasin — rolga qarab ichkariga
  if (isAuthenticated && !mutation.isPending) return <Navigate to="/" replace />;

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // Brauzerning standart xabari ("Заполните это поле") o'rniga o'zbekcha, i18n orqali
    const next: FieldErrors = {
      ...(phone.trim() ? {} : { phone: t('auth.phoneRequired') }),
      ...(password ? {} : { password: t('auth.passwordRequired') }),
    };
    setErrors(next);
    if (next.phone) return phoneRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    mutation.mutate({ phone, password });
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand">{t('app.name')}</h1>
          <p className="text-sm text-gray-500">{t('app.tagline')}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="login-phone" className="block text-sm font-medium">
            {t('auth.phone')}
          </label>
          <input
            id="login-phone"
            ref={phoneRef}
            className="field"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="+998901234567"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? 'login-phone-error' : undefined}
          />
          {errors.phone && (
            <p id="login-phone-error" className="text-xs text-danger">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="login-password" className="block text-sm font-medium">
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              id="login-password"
              ref={passwordRef}
              className="field pr-11"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="text-xs text-danger">
              {errors.password}
            </p>
          )}
        </div>

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {extractApiError(mutation.error)}
          </p>
        )}

        <button type="submit" className="btn-brand w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        <p className="text-center text-xs text-gray-500">{t('auth.forgotHint')}</p>

        <LanguageSwitch compact />
      </form>
    </div>
  );
}
