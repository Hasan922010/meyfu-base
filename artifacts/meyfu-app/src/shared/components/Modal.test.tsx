import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal — audit FE-113', () => {
  it('ochilganda fokus dialog ichida, fon bosilsa yopilmaydi, Escape yopadi', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Sinov" onClose={onClose}>
        <input aria-label="Nom" />
      </Modal>,
    );

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
