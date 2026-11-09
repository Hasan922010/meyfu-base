import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuantityStepper } from './QuantityStepper';

describe('QuantityStepper component', () => {
  it('kamaytirish va ko‘paytirish tugmalari to‘g‘ri ishlaydi', () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={5}
        unitLabel="qadoq"
        onChange={onChange}
      />,
    );

    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('qadoq')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ko\'paytirish' }));
    expect(onChange).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByRole('button', { name: 'Kamaytirish' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('tezkor son tanlash tugmasi bosilganda mos qiymat beriladi', () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper
        value={1}
        unitLabel="karopka"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '10' }));
    expect(onChange).toHaveBeenCalledWith(10);
  });
});
