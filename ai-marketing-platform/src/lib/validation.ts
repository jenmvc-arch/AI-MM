import { z } from "zod";

export const workspaceSchema = z.object({ name: z.string().trim().min(2).max(80), brandName: z.string().trim().min(2).max(120), defaultCurrency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().min(3).max(80), organizationId: z.string().uuid().optional() });
export const brandSchema = z.object({ workspaceId: z.string().uuid(), name: z.string().trim().min(2).max(120), website: z.string().trim().url().or(z.literal("")), description: z.string().trim().max(2000), tone: z.string().trim().max(500), market: z.string().trim().max(500) });

export const productSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  price: z.number().finite().min(0).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
