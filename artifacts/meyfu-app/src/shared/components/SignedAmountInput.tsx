import { useState, type ReactElement } from 'react';

import { AmountInput } from '@/shared/components/AmountInput';
import { amountDigits } from '@/shared/lib/format';

interface Props {
  /** Ishorali xom qiymat, masalan "-150000" yoki "150000" (bo'sh — kiritilmagan) */
  value: string;
  onChange: (signed: string) => void;
  positiveLabel: string;
  negativeLabel: string;
}

/**
 * Ishorali summa: yo'nalish (musbat/manfiy) aniq tugmalar bilan tanlanadi,
 * miqdor esa {@link AmountInput} bilan kiritiladi (CLAUDE.md 8 — aniq,
 * ayblovsiz UI: bare minus belgisi o'rniga tushunarli yorliqlar).
 *
 * Yo'nalish mustaqil holat sifatida saqlanadi (`value`dan emas) — aks holda
 * miqdor hali bo'sh bo'lganda "manfiy"ni tanlash iz qoldirmay yo'qolib,
 * keyin kiritilgan raqam kutilmaganda musbat bo'lib qolar edi.
 */
export function SignedAmountInput({
  value,
  onChange,
  positiveLabel,
  negativeLabel,
}: Props): ReactElement {
  const [isNegative, setIsNegative] = useState<boolean>(value.trim().startsWith('-'));
  const magnitude = amountDigits(value);

  const apply = (negative: boolean, digits: string) => {
    onChange(negative && digits ? `-${digits}` : digits);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn flex-1 ${!isNegative ? 'btn-brand' : ''}`}
          onClick={() => {
            setIsNegative(false);
            apply(false, magnitude);
          }}
        >
          {positiveLabel}
        </button>
        <button
          type="button"
          className={`btn flex-1 ${isNegative ? 'btn-brand' : ''}`}
          onClick={() => {
            setIsNegative(true);
            apply(true, magnitude);
          }}
        >
          {negativeLabel}
        </button>
      </div>
      <AmountInput
        value={magnitude}
        onChange={(digits) => apply(isNegative, digits)}
        showWords={false}
      />
    </div>
  );
}
