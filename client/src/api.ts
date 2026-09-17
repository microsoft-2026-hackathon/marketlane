import type {
  ApiErrorPayload,
  CartQuote,
  CatalogPage,
  CatalogQuery,
  CheckoutRequest,
  Customer,
  InventoryAdjustment,
  InventoryMovement,
  InventoryState,
  Locale,
  Order,
  OrderStatus,
  Overview,
  Product,
  ProductUpdate,
  QuoteRequest,
  StoreConfig,
} from "../../shared/contracts.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> | undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null
    && "message" in error && typeof error.message === "string"
    && "code" in error && typeof error.code === "string";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const available = error.details?.available;
    const sku = error.details?.sku;
    if (error.code === "INSUFFICIENT_STOCK" && typeof available === "number") {
      return `${error.message}${typeof sku === "string" ? ` ${sku}:` : ""} 현재 재고 ${available}개. 수량을 수정하거나 상품을 삭제해 주세요.`;
    }
    const issues = error.details?.issues;
    if (Array.isArray(issues)) {
      const messages: string[] = [];
      for (const issue of issues) {
        if (typeof issue === "object" && issue !== null && "message" in issue && typeof issue.message === "string") {
          const path = "path" in issue && typeof issue.path === "string" ? `${issue.path}: ` : "";
          messages.push(`${path}${issue.message}`);
        }
      }
      if (messages.length > 0) return `${error.message} ${messages.join(" ")}`;
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Marketlane에 연결하지 못했습니다. 로컬 서버와 연결 상태를 확인해 주세요.";
  }
  return error instanceof Error ? error.message : "예상하지 못한 오류가 발생했습니다. 다시 시도해 주세요.";
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof SyntaxError) {
      throw new Error(`Marketlane 응답을 읽을 수 없습니다 (HTTP ${response.status}).`);
    }
    throw error;
  }
  if (!response.ok) {
    if (isErrorPayload(payload)) {
      throw new ApiError(payload.error.message, response.status, payload.error.code, payload.error.details);
    }
    throw new ApiError(`요청을 처리하지 못했습니다 (HTTP ${response.status}).`, response.status, "HTTP_ERROR", undefined);
  }
  return payload as T;
}

function get<T>(path: string, signal: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

function send<T>(path: string, method: "POST" | "PATCH", body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method, body: JSON.stringify(body), ...(signal ? { signal } : {}) });
}

export const api = {
  config: (signal: AbortSignal) => get<StoreConfig>("/config", signal),
  customers: (signal: AbortSignal) => get<{ items: Customer[] }>("/customers", signal),
  overview: (signal: AbortSignal) => get<Overview>("/overview", signal),
  catalog: (query: CatalogQuery, signal: AbortSignal) =>
    get<CatalogPage>(`/catalog${queryString({ ...query })}`, signal),
  product: (id: string, locale: Locale, signal: AbortSignal) =>
    get<{ product: Product }>(`/products/${encodeURIComponent(id)}${queryString({ locale })}`, signal),
  inventory: (locale: Locale, signal: AbortSignal) =>
    get<InventoryState>(`/inventory${queryString({ locale })}`, signal),
  orders: (customerId: string, status: OrderStatus | "", signal: AbortSignal) =>
    get<{ items: Order[] }>(`/orders${queryString({ customerId, status, limit: 100 })}`, signal),
  order: (id: string, signal: AbortSignal) =>
    get<{ order: Order }>(`/orders/${encodeURIComponent(id)}`, signal),
  quote: (body: QuoteRequest, locale: Locale, signal: AbortSignal) =>
    send<CartQuote>(`/quotes${queryString({ locale })}`, "POST", body, signal),
  checkout: (body: CheckoutRequest, locale: Locale) =>
    send<{ order: Order }>(`/orders${queryString({ locale })}`, "POST", body),
  adjustInventory: (body: InventoryAdjustment) =>
    send<{ product: Product; movement: InventoryMovement }>("/inventory/adjustments", "POST", body),
  updateProduct: (id: string, body: ProductUpdate) =>
    send<{ product: Product }>(`/products/${encodeURIComponent(id)}`, "PATCH", body),
  updateOrderStatus: (id: string, status: "packing" | "shipped") =>
    send<{ order: Order }>(`/orders/${encodeURIComponent(id)}/status`, "PATCH", { status }),
};
