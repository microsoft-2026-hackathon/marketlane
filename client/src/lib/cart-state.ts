import type { CartLine, Locale } from "../../../shared/contracts.js";

export const MAX_CART_LINES = 40;
export const MAX_QUANTITY = 99;

export type StoredCartResult =
  | { ok: true; items: CartLine[] }
  | { ok: false; message: string };

function validProductId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 100 && value === value.trim()
    && !/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value);
}

export function validateCartLines(value: unknown): value is CartLine[] {
  if (!Array.isArray(value) || value.length > MAX_CART_LINES) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    if (keys.length !== 2 || !keys.includes("productId") || !keys.includes("quantity")) return false;
    if (!validProductId(item.productId) || ids.has(item.productId)) return false;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) return false;
    ids.add(item.productId);
  }
  return true;
}

export function decodeStoredCart(raw: string | null): StoredCartResult {
  if (raw === null) return { ok: true, items: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, message: "The saved cart is not readable JSON." };
  }
  if (!validateCartLines(value)) {
    return { ok: false, message: "The saved cart contains invalid items or quantities." };
  }
  return { ok: true, items: value.map(({ productId, quantity }) => ({ productId, quantity })) };
}

export function encodeStoredCart(items: CartLine[]): string {
  if (!validateCartLines(items)) throw new Error("The draft cart contains invalid items or quantities.");
  return JSON.stringify(items.map(({ productId, quantity }) => ({ productId, quantity })));
}

export function cartStorageKey(customerId: string): string {
  if (!validProductId(customerId)) throw new Error("Select a customer before using a cart.");
  return `marketlane.cart.v1:${encodeURIComponent(customerId)}`;
}

export function setLineQuantity(items: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!validateCartLines(items)) throw new Error("The draft cart needs to be recovered before it can be edited.");
  if (!validProductId(productId)) throw new Error("This product has an invalid ID.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`Use a whole quantity between 1 and ${MAX_QUANTITY}.`);
  }
  const exists = items.some((item) => item.productId === productId);
  if (!exists && items.length >= MAX_CART_LINES) {
    throw new Error(`A cart can contain at most ${MAX_CART_LINES} different products.`);
  }
  return exists
    ? items.map((item) => item.productId === productId ? { productId, quantity } : item)
    : [...items, { productId, quantity }];
}

export function addCartLine(items: CartLine[], productId: string, quantity = 1): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a positive whole quantity.");
  const existing = items.find((item) => item.productId === productId)?.quantity ?? 0;
  return setLineQuantity(items, productId, existing + quantity);
}

export function removeCartLine(items: CartLine[], productId: string): CartLine[] {
  return items.filter((item) => item.productId !== productId);
}

export function itemCount(items: CartLine[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function quantityFromInput(input: string): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const quantity = Number(input.trim());
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY ? quantity : null;
}

export function sameCartLines(left: CartLine[], right: CartLine[]): boolean {
  if (left.length !== right.length) return false;
  const quantities = new Map(left.map((item) => [item.productId, item.quantity]));
  return quantities.size === left.length && new Set(right.map((item) => item.productId)).size === right.length
    && right.every((item) => quantities.get(item.productId) === item.quantity);
}

export function quoteDraftKey(customerId: string, locale: Locale, items: CartLine[], couponCode: string): string {
  return JSON.stringify([customerId, locale, items.map(({ productId, quantity }) => [productId, quantity]), couponCode]);
}
