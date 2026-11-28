import { forwardRef, useLayoutEffect, useRef, type ReactElement } from 'react';

import { amountDigits, groupThousands, numberToWordsUz } from '@/shared/lib/format';

interface Props {
  /** Xom qiymat — faqat raqamlar (masalan "1250000") */
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  autoFocus?: boolean | undefined;
  /** So'z bilan yozuvni ko'rsatish (default: true) */
  showWords?: boolean | undefined;
  suffix?: string | undefined;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
}

/**
 * Pul kiritish maydoni. Yozish paytida raqamlar guruhlanib ko'rinadi
 * (1 250 000), ostida summa so'z bilan chiqadi ("bir million ... so'm").
 */
export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  {
    value,
    onChange,
    placeholder = '0',
    className = '',
    autoFocus,
    showWords = true,
    suffix = "so'm",
    disabled,
    ariaLabel,
  },
  ref,
): ReactElement {
  const digits = amountDigits(String(value ?? ''));
  const formatted = digits ? groupThousands(digits) : '';
  const n = Number(digits || 0);
  const innerRef = useRef<HTMLInputElement | null>(null);
  const caretDigitsRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    const digitsBefore = caretDigitsRef.current;
    if (!el || digitsBefore === null || document.activeElement !== el) return;
    caretDigitsRef.current = null;
    let seen = 0;
    let pos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i]!)) seen++;
      if (seen >= digitsBefore) {
        pos = digitsBefore === 0 ? 0 : i + 1;
        break;
      }
    }
    el.setSelectionRange(pos, pos);
  }, [formatted]);

  return (
    <div>
      <input
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        className={`field tabular-nums ${className}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        value={formatted}
        onChange={(e) => {
          const caret = e.target.selectionStart ?? e.target.value.length;
          caretDigitsRef.current = e.target.value.slice(0, caret).replace(/\D/g, '').length;
          onChange(e.target.value.replace(/\D/g, ''));
        }}
      />
      {showWords && n > 0 && (
        <p className="mt-1 text-xs text-gray-500 first-letter:uppercase">
          {numberToWordsUz(n)} {suffix}
        </p>
      )}
    </div>
  );
});
