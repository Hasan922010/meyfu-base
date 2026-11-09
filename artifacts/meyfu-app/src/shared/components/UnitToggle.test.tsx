import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UnitToggle } from './UnitToggle';

describe('UnitToggle component', () => {
  it('dona va qadoq variantlarini to‘g‘ri aks ettiradi va bosilganda onChange chaqiradi', () => {
    const onChange = vi.fn();
    render(
      <UnitToggle
        mode="base"
        baseUnit="dona"
        packageType="karopka"
        packQuantity={12}
        onChange={onChange}
      />,
    );

    const baseBtn = screen.getByRole('button', { name: 'Dona (dona)' });
    const packBtn = screen.getByRole('button', { name: 'Qadoq (karopka — 12 dona)' });

    expect(baseBtn).toHaveAttribute('aria-pressed', 'true');
    expect(packBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(packBtn);
    expect(onChange).toHaveBeenCalledWith('package');
  });
});
