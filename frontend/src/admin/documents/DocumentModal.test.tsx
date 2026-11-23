import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const warehouseApi = vi.hoisted(() => ({
  purchase: vi.fn(),
  loading: vi.fn(),
  transfer: vi.fn(),
  inventoryCount: vi.fn(),
  purchasePdf: vi.fn(),
  loadingPdf: vi.fn(),
}));

vi.mock('@/shared/api/warehouse', () => ({ warehouseApi }));
vi.mock('@/shared/api/reports', () => ({ dayCloseApi: { dailyReturn: vi.fn() } }));

import { DocumentModal } from './DocumentModal';

function renderModal(type: 'purchase' | 'loading') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DocumentModal
        doc={{
          type,
          id: 'doc-1',
          number: 'DOC-001',
          label: type === 'purchase' ? 'Kirim' : 'Yuklama',
        }}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DocumentModal — qadoq/quti miqdor formati', () => {
  it('yuklama hujjatida qadoqli mahsulot miqdorini qop/qutida ko‘rsatadi', async () => {
    warehouseApi.loading.mockResolvedValue({
      id: 'doc-1',
      number: 'YK-001',
      date: '2026-11-16',
      distributor_name: 'Shaxzod',
      warehouse_name: 'Asosiy ombor',
      status_display: 'Yuborilgan',
      items: [
        {
          id: 'i1',
          product: 'p1',
          product_name: 'Poroshok 900gr',
          quantity: '2.000',
          pack_quantity: '12.000',
          package_type: 'qop',
          unit_name: 'dona',
        },
      ],
    });

    renderModal('loading');

    expect(await screen.findByText('Poroshok 900gr')).toBeInTheDocument();
    expect(screen.getByText('2 qop')).toBeInTheDocument();
  });

  it('kirim hujjatida qadoqli mahsulot miqdorini qop/qutida ko‘rsatadi', async () => {
    warehouseApi.purchase.mockResolvedValue({
      id: 'doc-1',
      number: 'KIR-001',
      date: '2026-11-16',
      supplier_name: 'Meyfu Zavod',
      warehouse_name: 'Asosiy ombor',
      invoice_number: 'INV-1',
      status_display: 'Tasdiqlangan',
      items: [
        {
          id: 'i1',
          product: 'p1',
          product_name: 'Gel 450gr',
          quantity: '2.000',
          cost_price: '11500.00',
          pack_quantity: '18.000',
          package_type: 'quti',
          unit_name: 'dona',
        },
      ],
    });

    renderModal('purchase');

    expect(await screen.findByText('Gel 450gr')).toBeInTheDocument();
    expect(screen.getByText('2 quti')).toBeInTheDocument();
  });
});
