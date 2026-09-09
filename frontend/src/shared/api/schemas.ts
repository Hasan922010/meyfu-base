import { z } from 'zod';

// Audit TS-001 — kritik API chegaralari uchun runtime sxemalar.
// Ataylab "loose": faqat ilova ishlashi uchun zarur maydonlar tekshiriladi.

export const roleSchema = z.enum([
  'SUPER_ADMIN',
  'MANAGER',
  'WAREHOUSE',
  'DISTRIBUTOR',
  'ACCOUNTANT',
]);

export const userShape = z
  .object({
    id: z.string(),
    phone: z.string(),
    full_name: z.string(),
    role: roleSchema,
  })
  .passthrough();

/** `POST /auth/login/` → `data.data` */
export const loginDataShape = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
  user: userShape,
});

/** `POST /sales/bulk-sync/` → `data.data` */
export const bulkSyncDataShape = z.object({
  results: z.array(
    z
      .object({
        client_uuid: z.string(),
        status: z.string(),
        server_id: z.string().optional(),
        error: z
          .object({ code: z.string().optional(), message: z.string().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  ),
  server_time: z.string().optional(),
});

/** Katalogdan lokal bazaga tortiladigan minimal shakllar (`pullReferenceData`). */
export const productShape = z
  .object({ id: z.string(), name: z.string() })
  .passthrough();
export const clientShape = z
  .object({ id: z.string(), name: z.string() })
  .passthrough();
export const vanStockShape = z
  .object({ product: z.string(), quantity: z.union([z.string(), z.number()]) })
  .passthrough();

export const productListShape = z.array(productShape);
export const clientListShape = z.array(clientShape);
export const vanStockListShape = z.array(vanStockShape);
