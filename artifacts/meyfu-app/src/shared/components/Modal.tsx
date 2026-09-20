import { X } from 'lucide-react';
import type { PropsWithChildren, ReactElement } from 'react';
import { useEffect } from 'react';

interface Props extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
}

const WIDTH: Record<NonNullable<Props['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: Props): ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`mt-10 w-full ${WIDTH[size]} rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Yopish"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
