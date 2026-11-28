import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  it('serverdan kelgan "30000.00" ni 30 000 deb ko‘rsatadi, 3 000 000 emas', () => {
    render(<AmountInput value="30000.00" onChange={() => undefined} showWords={false} />);

    expect(screen.getByRole('textbox')).toHaveValue('30 000');
  });

  it('1000000 kiritilganda 1 000 000 qilib guruhlab ko‘rsatadi', () => {
    function Harness() {
      const [val, setVal] = useState('');
      return <AmountInput value={val} onChange={setVal} showWords={false} />;
    }
    render(<Harness />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1000000' } });
    expect(input).toHaveValue('1 000 000');
  });
});
