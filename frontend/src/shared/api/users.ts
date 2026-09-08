import { create, listPage, patch, postAction, type QueryParams } from '@/shared/api/crud';
import type { DistributorProfile, User } from '@/shared/types/api';

export const authApi = {
  distributors: async (): Promise<User[]> => {
    const page = await listPage<User>('/users/', {
      role: 'DISTRIBUTOR',
      is_active: true,
      page_size: 200,
    });
    return page.results;
  },
};

export interface StaffInput {
  phone: string;
  full_name: string;
  role: User['role'];
  password?: string;
  passport_series?: string;
  address?: string;
  hire_date?: string | null;
  distributor_profile?: Partial<DistributorProfile>;
}

export const staffApi = {
  list: (params?: QueryParams) => listPage<User>('/users/', params),
  create: (body: StaffInput) => create<User, StaffInput>('/users/', body),
  update: (id: string, body: Partial<StaffInput>) =>
    patch<User, StaffInput>(`/users/${id}/`, body),
  toggleActive: (id: string) => postAction<User>(`/users/${id}/toggle_active/`),
};
