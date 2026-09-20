import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

function Boom(): ReactElement {
  throw new Error('patladi');
}

describe('ErrorBoundary (FE-001)', () => {
  it('bola xatosini ushlaydi va fallback ko‘rsatadi (oq ekran emas)', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/noto|wrong|не так/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('xato bo‘lmasa bolani o‘zgarishsiz render qiladi', () => {
    render(
      <ErrorBoundary>
        <p>ishlayapti</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ishlayapti')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('yonidagi (sibling) daraxtga ta’sir qilmaydi — faqat o‘z sohasi yiqiladi', () => {
    render(
      <div>
        <span>tashqi-kontent</span>
        <ErrorBoundary variant="page">
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('tashqi-kontent')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('"Qayta urinish" bosilganda bola qayta render qilinadi', async () => {
    let shouldThrow = true;
    function Flaky(): ReactElement {
      const [, force] = useState(0);
      void force;
      if (shouldThrow) throw new Error('bir marta');
      return <p>tuzaldi</p>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /qayta|try|повтор/i }));
    expect(screen.getByText('tuzaldi')).toBeInTheDocument();
  });
});
