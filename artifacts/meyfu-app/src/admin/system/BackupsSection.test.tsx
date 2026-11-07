import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BackupItem } from '@/shared/api/backup';

const mockBackups: BackupItem[] = [
  {
    filename: 'db_20261004_120000.sql.gz',
    size_bytes: 1048576,
    size_mb: 1.0,
    created_at: '2026-10-04T12:00:00Z',
    checksum_sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    format: 'sql',
    db_engine: 'postgresql',
    is_safety: false,
    valid: true,
    note: 'Asosiy kundalik zaxira',
  },
  {
    filename: 'safety_20261004_115000.json.gz',
    size_bytes: 524288,
    size_mb: 0.5,
    created_at: '2026-10-04T11:50:00Z',
    checksum_sha256: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5',
    format: 'json',
    db_engine: 'postgresql',
    is_safety: true,
    valid: true,
    note: 'Himoya nusxasi',
  },
];

const backupApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  restore: vi.fn(),
  delete: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/shared/api/backup', () => ({ backupApi }));

let mockRole = 'SUPER_ADMIN';
vi.mock('@/shared/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) =>
    sel({ user: { role: mockRole } }),
}));

import { BackupsSection } from './BackupsSection';

describe('BackupsSection', () => {
  it('zaxiralar ro‘yxati jadvalda ko‘rsatiladi va formatlar ajratiladi', async () => {
    mockRole = 'SUPER_ADMIN';
    backupApi.list.mockResolvedValue(mockBackups);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BackupsSection />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('db_20261004_120000.sql.gz')).toBeInTheDocument();
    expect(screen.getByText('safety_20261004_115000.json.gz')).toBeInTheDocument();
    expect(screen.getAllByText(/Himoya nusxasi/).length).toBeGreaterThan(0);
    expect(screen.getByText('Jami zaxiralar')).toBeInTheDocument();
  });

  it('tiklash tugmasi xavfli modalni ochadi va tasdiqlash chekboksisiz ruxsat bermaydi', async () => {
    mockRole = 'SUPER_ADMIN';
    backupApi.list.mockResolvedValue(mockBackups);
    backupApi.restore.mockResolvedValue({
      success: true,
      restored_file: 'db_20261004_120000.sql.gz',
      safety_backup: 'safety_auto.json.gz',
      integrity: { ok: true, mismatch_count: 0 },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BackupsSection />
      </QueryClientProvider>,
    );

    await screen.findByText('db_20261004_120000.sql.gz');

    // Tiklash tugmasini bosish
    const restoreButtons = screen.getAllByTitle('Zaxiradan tiklash');
    fireEvent.click(restoreButtons[0]!);

    // Modal sarlavhasi va ogohlantirish ko'rinishi
    expect(await screen.findByText(/Zaxiradan tiklash \(Restore\)/)).toBeInTheDocument();
    expect(screen.getByText(/Avtomatik himoya/)).toBeInTheDocument();

    const submitBtn = screen.getByText('Tiklashni boshlash');
    expect(submitBtn).toBeDisabled();

    // Chekboksni belgilash
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(submitBtn).not.toBeDisabled();

    // Tiklashni boshlash
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(backupApi.restore).toHaveBeenCalledWith('db_20261004_120000.sql.gz');
    });
  });
});
