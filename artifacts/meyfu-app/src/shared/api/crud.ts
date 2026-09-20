import { api } from '@/shared/api/client';
import type { ApiSuccess, PaginatedData } from '@/shared/types/api';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export async function listPage<T>(
  path: string,
  params?: QueryParams,
): Promise<PaginatedData<T>> {
  const { data } = await api.get<ApiSuccess<PaginatedData<T>>>(path, { params });
  return data.data;
}

export async function retrieve<T>(path: string): Promise<T> {
  const { data } = await api.get<ApiSuccess<T>>(path);
  return data.data;
}

export async function create<T, TInput>(path: string, body: TInput): Promise<T> {
  const { data } = await api.post<ApiSuccess<T>>(path, body);
  return data.data;
}

export async function patch<T, TInput>(path: string, body: Partial<TInput>): Promise<T> {
  const { data } = await api.patch<ApiSuccess<T>>(path, body);
  return data.data;
}

export async function remove(path: string): Promise<void> {
  await api.delete(path);
}

export async function postAction<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await api.post<ApiSuccess<T>>(path, body ?? {});
  return data.data;
}
