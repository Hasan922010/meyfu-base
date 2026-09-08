import { api } from '@/shared/api/client';
import { create, listPage, patch, type QueryParams } from '@/shared/api/crud';
import type { ApiSuccess } from '@/shared/types/api';
import type {
  Brand,
  Category,
  Product,
  ProductImage,
  ProductInput,
  Unit,
} from '@/shared/types/catalog';

export const catalogApi = {
  products: (params?: QueryParams) => listPage<Product>('/products/', params),
  product: (id: string) =>
    api.get<ApiSuccess<Product>>(`/products/${id}/`).then((r) => r.data.data),
  createProduct: (body: ProductInput) => create<Product, ProductInput>('/products/', body),
  updateProduct: (id: string, body: Partial<ProductInput>) =>
    patch<Product, ProductInput>(`/products/${id}/`, body),

  uploadImages: async (productId: string, files: File[]): Promise<ProductImage[]> => {
    const form = new FormData();
    for (const f of files) form.append('images', f);
    const { data } = await api.post<ApiSuccess<ProductImage[]>>(
      `/products/${productId}/images/`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },
  patchImage: async (
    productId: string,
    imageId: string,
    body: { sort_order?: number; is_primary?: boolean },
  ): Promise<ProductImage> => {
    const { data } = await api.patch<ApiSuccess<ProductImage>>(
      `/products/${productId}/images/${imageId}/`,
      body,
    );
    return data.data;
  },
  deleteImage: (productId: string, imageId: string) =>
    api.delete(`/products/${productId}/images/${imageId}/`),

  categories: (params?: QueryParams) => listPage<Category>('/categories/', params),
  createCategory: (body: { name: string; parent?: string | null }) =>
    create<Category, { name: string }>('/categories/', body),

  brands: (params?: QueryParams) => listPage<Brand>('/brands/', params),
  createBrand: (body: { name: string }) => create<Brand, { name: string }>('/brands/', body),

  units: (params?: QueryParams) => listPage<Unit>('/units/', params),
  createUnit: (body: { name: string; short_name: string }) =>
    create<Unit, { name: string; short_name: string }>('/units/', body),
};
