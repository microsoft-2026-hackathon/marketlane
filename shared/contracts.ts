export type Locale = "en" | "ko";
export type Category = "desk" | "carry" | "paper";
export type CatalogSort = "featured" | "price-asc" | "price-desc" | "name";
export type ProductTone = "sage" | "clay" | "ink" | "sand" | "sky";
export type ProductShape = "lamp" | "mat" | "notebook" | "bottle" | "stand" | "bag" | "pen" | "tray";
export type OrderStatus = "placed" | "packing" | "shipped";

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  priceCents: number;
  stockOnHand: number;
  lowStockThreshold: number;
  featured: boolean;
  tone: ProductTone;
  shape: ProductShape;
  locale: Locale;
  contentLocale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogQuery {
  locale?: Locale;
  q?: string;
  category?: Category;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
  inStock?: boolean;
}

export interface CatalogPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface QuoteRequest {
  customerId: string;
  items: CartLine[];
  couponCode?: string;
}

export interface CheckoutRequest extends QuoteRequest {
  note?: string;
}

export interface QuoteLine {
  productId: string;
  sku: string;
  name: string;
  category: Category;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  discountCents: number;
  lineTotalCents: number;
  stockOnHand: number;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
}

export interface CartQuote {
  currency: "USD";
  locale: Locale;
  items: QuoteLine[];
  totals: Totals;
  coupon: { code: string; percent: number } | null;
  quotedAt: string;
}

export type OrderLine = Omit<QuoteLine, "stockOnHand">;

export interface Order {
  id: string;
  number: string;
  customer: Customer;
  locale: Locale;
  currency: "USD";
  status: OrderStatus;
  items: OrderLine[];
  totals: Totals;
  couponCode: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  packedAt: string | null;
  shippedAt: string | null;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  sku: string;
  delta: number;
  reason: string;
  reference: string | null;
  createdAt: string;
}

export interface InventoryState {
  items: Product[];
  movements: InventoryMovement[];
}

export interface InventoryAdjustment {
  productId: string;
  delta: number;
  reason: string;
  reference?: string;
}

export interface ProductUpdate {
  locale: Locale;
  name: string;
  description: string;
  priceCents: number;
  featured: boolean;
}

export interface Overview {
  productCount: number;
  lowStockCount: number;
  openOrderCount: number;
  bookedSalesCents: number;
  recentOrders: Order[];
  categorySales: { category: Category; units: number; revenueCents: number }[];
}

export interface StoreConfig {
  storeName: "Marketlane";
  currency: "USD";
  shippingFeeCents: number;
  freeShippingThresholdCents: number;
  supportedLocales: Locale[];
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
