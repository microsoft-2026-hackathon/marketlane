import { z } from "zod";
import type { CheckoutRequest, InventoryAdjustment, QuoteRequest } from "../../shared/contracts.js";
import { AppError } from "./errors.js";

export const localeSchema = z.enum(["en", "ko"]);
export const categorySchema = z.enum(["desk", "carry", "paper"]);
export const localeQuerySchema = z.object({ locale: localeSchema.default("en") }).strict();

export const catalogQuerySchema = z.object({
  locale: localeSchema.default("en"),
  q: z.string().trim().max(120).default(""),
  category: categorySchema.optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "name"]).default("featured"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(6),
  inStock: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
}).strict();

const itemSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
}).strict();

const quoteSchema = z.object({
  customerId: z.string().trim().min(1).max(100),
  items: z.array(itemSchema).min(1).max(40),
  couponCode: z.string().trim().max(40).optional(),
}).strict();

const checkoutSchema = quoteSchema.extend({
  note: z.string().trim().max(500).optional(),
}).strict();

function normalizeQuote(data: z.infer<typeof quoteSchema>): QuoteRequest {
  const unique = new Set(data.items.map(item => item.productId));
  if (unique.size !== data.items.length) {
    throw new AppError(400, "DUPLICATE_PRODUCT", "장바구니에 같은 상품을 중복 항목으로 넣을 수 없습니다.");
  }
  const couponCode = data.couponCode?.toUpperCase();
  return {
    customerId: data.customerId,
    items: data.items,
    ...(couponCode ? { couponCode } : {}),
  };
}

export function parseQuote(input: unknown): QuoteRequest {
  return normalizeQuote(quoteSchema.parse(input));
}

export function parseCheckout(input: unknown): CheckoutRequest {
  const data = checkoutSchema.parse(input);
  return { ...normalizeQuote(data), ...(data.note ? { note: data.note } : {}) };
}

export const productUpdateSchema = z.object({
  locale: localeSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  priceCents: z.number().int().min(1).max(10_000_000),
  featured: z.boolean(),
}).strict();

const adjustmentSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  delta: z.number().int().min(-10_000).max(10_000).refine(value => value !== 0, "Delta must not be zero."),
  reason: z.string().trim().min(3).max(240),
  reference: z.string().trim().max(80).optional(),
}).strict();

export function parseAdjustment(input: unknown): InventoryAdjustment {
  const data = adjustmentSchema.parse(input);
  return {
    productId: data.productId,
    delta: data.delta,
    reason: data.reason,
    ...(data.reference ? { reference: data.reference } : {}),
  };
}

export const orderListSchema = z.object({
  customerId: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["placed", "packing", "shipped"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const orderStatusSchema = z.object({
  status: z.enum(["packing", "shipped"]),
}).strict();
