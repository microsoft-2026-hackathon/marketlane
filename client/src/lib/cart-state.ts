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
    return { ok: false, message: "저장된 장바구니를 JSON으로 읽을 수 없습니다." };
  }
  if (!validateCartLines(value)) {
    return { ok: false, message: "저장된 장바구니의 상품이나 수량이 올바르지 않습니다." };
  }
  return { ok: true, items: value.map(({ productId, quantity }) => ({ productId, quantity })) };
}

export function encodeStoredCart(items: CartLine[]): string {
  if (!validateCartLines(items)) throw new Error("장바구니의 상품이나 수량이 올바르지 않습니다.");
  return JSON.stringify(items.map(({ productId, quantity }) => ({ productId, quantity })));
}

export function cartStorageKey(customerId: string): string {
  if (!validProductId(customerId)) throw new Error("장바구니를 사용하려면 고객을 선택해 주세요.");
  return `marketlane.cart.v1:${encodeURIComponent(customerId)}`;
}

export function setLineQuantity(items: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!validateCartLines(items)) throw new Error("장바구니를 복구한 뒤 수정해 주세요.");
  if (!validProductId(productId)) throw new Error("상품 ID가 올바르지 않습니다.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`1~${MAX_QUANTITY} 사이의 정수를 입력해 주세요.`);
  }
  const exists = items.some((item) => item.productId === productId);
  if (!exists && items.length >= MAX_CART_LINES) {
    throw new Error(`장바구니에는 최대 ${MAX_CART_LINES}종의 상품을 담을 수 있습니다.`);
  }
  return exists
    ? items.map((item) => item.productId === productId ? { productId, quantity } : item)
    : [...items, { productId, quantity }];
}

export function addCartLine(items: CartLine[], productId: string, quantity = 1): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("수량은 양의 정수로 입력해 주세요.");
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
