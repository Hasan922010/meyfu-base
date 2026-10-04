import { api } from '@/shared/api/client';
import { postAction, remove, retrieve } from '@/shared/api/crud';

export interface BackupItem {
  filename: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
  checksum_sha256: string;
  format: 'sql' | 'json' | 'sqlite';
  db_engine: string;
  is_safety: boolean;
  valid: boolean;
  note?: string;
  record_counts?: Record<string, number>;
  created_by?: {
    id: string | null;
    phone: string;
  } | null;
}

export interface RestoreResult {
  success: boolean;
  restored_file: string;
  safety_backup: string | null;
  integrity: {
    ok: boolean;
    mismatch_count: number;
  };
}

export const backupApi = {
  list: () => retrieve<BackupItem[]>('/system/backups/'),

  create: (params?: { format?: 'auto' | 'sql' | 'json' | 'sqlite'; note?: string }) =>
    postAction<BackupItem>('/system/backups/create/', params ?? {}),

  restore: (filename: string, createSafety = true) =>
    postAction<RestoreResult>(`/system/backups/${encodeURIComponent(filename)}/restore/`, {
      create_safety: createSafety,
    }),

  delete: (filename: string) =>
    remove(`/system/backups/${encodeURIComponent(filename)}/`),

  upload: async (file: File): Promise<BackupItem> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; data: BackupItem }>(
      '/system/backups/upload/',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return res.data.data;
  },

  download: async (filename: string): Promise<void> => {
    const res = await api.get(`/system/backups/${encodeURIComponent(filename)}/download/`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
