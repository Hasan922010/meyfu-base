import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PriceFormulaCard } from './PriceFormulaCard';

describe('PriceFormulaCard component', () => {
  it('qadoq holatida formulani to‘g‘ri aks ettiradi', () => {
    render(
      <PriceFormulaCard
        isPackage={true}
        packageCount={10}
        packageType="karopka"
        packQuantity={12}
        baseUnit="dona"
        totalBaseQty={120}
        unitPrice={25000}
        totalPrice={3000000}
      />,
    );

    expect(screen.getByText('10 karopka × 12 dona = 120 dona')).toBeInTheDocument();
    expect(screen.getByText(/3 000 000/)).toBeInTheDocument();
  });

  it('dona holatida ixcham hisobni ko‘rsatadi', () => {
    render(
      <PriceFormulaCard
        isPackage={false}
        packageCount={5}
        packageType=""
        packQuantity={1}
        baseUnit="dona"
        totalBaseQty={5}
        unitPrice={20000}
        totalPrice={100000}
      />,
    );

    expect(screen.getByText(/5 dona ×/)).toBeInTheDocument();
    expect(screen.getByText(/100 000/)).toBeInTheDocument();
  });
});

