import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  it('serverdan kelgan "30000.00" ni 30 000 deb ko‘rsatadi, 3 000 000 emas', () => {
    render(<AmountInput value="30000.00" onChange={() => undefined} showWords={false} />);

    expect(screen.getByRole('textbox')).toHaveValue('30 000');
  });
});
