import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { confirmPasswordReset, requestPasswordReset } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { LanguageSwitch } from '@/shared/components/LanguageSwitch';

const CODE_RE = /^\d{6}$/;
const MIN_PASSWORD_LENGTH = 8;

type Step = 'phone' | 'code' | 'done';
type FieldErrors = { phone?: string; code?: string; password?: string };

interface LocationState {
  phone?: string;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  children: (describedBy: string | undefined) => ReactNode;
}

function Field({ id, label, error, children }: FieldProps): ReactElement {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(error ? errorId : undefined)}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ResetPasswordPage(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const initialPhone = (location.state as LocationState | null)?.phone ?? '';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string>(initialPhone);
  const [code, setCode] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const requestMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => setStep('code'),
  });
  const confirmMutation = useMutation({
    mutationFn: confirmPasswordReset,
    onSuccess: () => setStep('done'),
  });
  const activeError = requestMutation.error ?? confirmMutation.error;

  function handleRequest(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const next: FieldErrors = phone.trim() ? {} : { phone: t('auth.phoneRequired') };
    setErrors(next);
    if (next.phone) return;
    confirmMutation.reset();
    requestMutation.mutate(phone);
  }

  function handleConfirm(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const next: FieldErrors = {
      ...(CODE_RE.test(code.trim()) ? {} : { code: t('auth.codeInvalid') }),
      ...(password.length >= MIN_PASSWORD_LENGTH ? {} : { password: t('auth.passwordTooShort') }),
    };
    setErrors(next);
    if (next.code || next.password) return;
    confirmMutation.mutate({ phone, code: code.trim(), new_password: password });
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        noValidate
        onSubmit={step === 'phone' ? handleRequest : handleConfirm}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand">{t('auth.resetTitle')}</h1>
          {step === 'phone' && <p className="text-sm text-gray-500">{t('auth.resetIntro')}</p>}
        </div>

        {step === 'done' ? (
          <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            {t('auth.resetDone')}
          </p>
        ) : (
          <>
            {step === 'phone' ? (
              <Field id="reset-phone" label={t('auth.phone')} error={errors.phone}>
                {(describedBy) => (
                  <input
                    id="reset-phone"
                    className="field"
                    type="tel"
                    inputMode="tel"
                    autoComplete="username"
                    placeholder="+998901234567"
                    autoFocus
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
            ) : (
              <>
                <p className="text-sm text-gray-500">{t('auth.codeSentHint')}</p>
                <Field id="reset-code" label={t('auth.code')} error={errors.code}>
                  {(describedBy) => (
                    <input
                      id="reset-code"
                      className="field tracking-widest"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      aria-invalid={errors.code ? true : undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </Field>
                <Field id="reset-password" label={t('auth.newPassword')} error={errors.password}>
                  {(describedBy) => (
                    <input
                      id="reset-password"
                      className="field"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={errors.password ? true : undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </Field>
              </>
            )}

            {activeError && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {extractApiError(activeError)}
              </p>
            )}

            {step === 'phone' ? (
              <button type="submit" className="btn-brand w-full" disabled={requestMutation.isPending}>
                {requestMutation.isPending ? t('auth.sendingCode') : t('auth.sendCode')}
              </button>
            ) : (
              <>
                <button type="submit" className="btn-brand w-full" disabled={confirmMutation.isPending}>
                  {confirmMutation.isPending ? t('auth.saving') : t('auth.savePassword')}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-brand hover:underline"
                  disabled={requestMutation.isPending}
                  onClick={() => requestMutation.mutate(phone)}
                >
                  {t('auth.resendCode')}
                </button>
              </>
            )}
          </>
        )}

        <Link to="/login" className="block text-center text-sm text-brand hover:underline">
          {t('auth.backToLogin')}
        </Link>

        <LanguageSwitch compact />
      </form>
    </div>
  );
}
