import { api } from '@/shared/api/client';
import type { ApiSuccess } from '@/shared/types/api';

export interface CompanySettings {
  id: string;
  name: string;
  legal_name: string;
  inn: string;
  address: string;
  phone: string;
  bank_details: string;
  director_name: string;
  logo: string | null;
  stamp: string | null;
  updated_at: string;
}

export interface CompanyPublic {
  name: string;
  legal_name: string;
  inn: string;
  address: string;
  phone: string;
  bank_details: string;
  director_name: string;
  logo: string | null; // data:URI
  stamp: string | null; // data:URI
  updated_at: string;
}

export type CompanySettingsInput = Partial<
  Omit<CompanySettings, 'id' | 'logo' | 'stamp' | 'updated_at'>
> & {
  logo?: File | null;
  stamp?: File | null;
};

export const companyApi = {
  get: () =>
    api
      .get<ApiSuccess<CompanySettings>>('/company-settings/')
      .then((r) => r.data.data),

  update: async (body: CompanySettingsInput): Promise<CompanySettings> => {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      if (value instanceof File) form.append(key, value);
      else form.append(key, String(value));
    }
    const { data } = await api.patch<ApiSuccess<CompanySettings>>(
      '/company-settings/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  public: () =>
    api
      .get<ApiSuccess<CompanyPublic>>('/company/public/')
      .then((r) => r.data.data),
};
