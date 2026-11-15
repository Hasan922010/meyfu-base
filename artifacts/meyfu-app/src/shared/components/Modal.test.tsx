import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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

  it("har bir belgi yozilganda (yangi onClose bilan qayta render) input fokusi yo'qolmaydi", () => {
    function Harness() {
      const [val, setVal] = useState('');
      return (
        <Modal open title="Sinov" onClose={() => {}}>
          <input
            aria-label="Summa"
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
        </Modal>
      );
    }

    render(<Harness />);
    const input = screen.getByLabelText<HTMLInputElement>('Summa');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: '5' } });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: '50' } });
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('50');
  });
});
