import { randomUUID } from "node:crypto";
import type {
  CartQuote, Category, Customer, Locale, Order, OrderLine, OrderStatus,
} from "../../shared/contracts.js";
import type { Database } from "../db/database.js";
import { notFound } from "../domain/errors.js";
import { orderListSchema } from "../domain/validation.js";

interface OrderRow {
  sequence: number;
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  locale: Locale;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  packed_at: string | null;
  shipped_at: string | null;
}

interface ItemRow {
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  category: Category;
  quantity: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  discount_cents: number;
  line_total_cents: number;
}

function loadItems(database: Database, ids: string[]): Map<string, OrderLine[]> {
  const grouped = new Map<string, OrderLine[]>();
  if (!ids.length) return grouped;
  const placeholders = ids.map(() => "?").join(", ");
  const rows = database.prepare<string[], ItemRow>(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY order_id, line_index`,
  ).all(...ids);
  for (const row of rows) {
    const items = grouped.get(row.order_id) ?? [];
    items.push({
      productId: row.product_id, sku: row.sku, name: row.name, category: row.category,
      quantity: row.quantity, unitPriceCents: row.unit_price_cents,
      lineSubtotalCents: row.line_subtotal_cents, discountCents: row.discount_cents,
      lineTotalCents: row.line_total_cents,
    });
    grouped.set(row.order_id, items);
  }
  return grouped;
}

function toOrder(row: OrderRow, items: OrderLine[]): Order {
  return {
    id: row.id,
    number: `ML-${1000 + row.sequence}`,
    customer: {
      id: row.customer_id, name: row.customer_name,
      email: row.customer_email, company: row.customer_company,
    },
    locale: row.locale, currency: "USD", status: row.status, items,
    totals: {
      subtotalCents: row.subtotal_cents, discountCents: row.discount_cents,
      shippingCents: row.shipping_cents, totalCents: row.total_cents,
    },
    couponCode: row.coupon_code, note: row.note, createdAt: row.created_at,
    updatedAt: row.updated_at, packedAt: row.packed_at, shippedAt: row.shipped_at,
  };
}

export function getOrder(database: Database, id: string): Order {
  const row = database.prepare<[string], OrderRow>("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) notFound("Order");
  return toOrder(row, loadItems(database, [id]).get(id) ?? []);
}

export function listOrders(database: Database, input: unknown = {}): Order[] {
  const query = orderListSchema.parse(input);
  const parameters = {
    customerId: query.customerId ?? null,
    status: query.status ?? null,
    limit: query.limit,
  };
  const rows = database.prepare<typeof parameters, OrderRow>(`
    SELECT * FROM orders
    WHERE (@customerId IS NULL OR customer_id = @customerId)
      AND (@status IS NULL OR status = @status)
    ORDER BY created_at DESC, sequence DESC LIMIT @limit
  `).all(parameters);
  const grouped = loadItems(database, rows.map(row => row.id));
  return rows.map(row => toOrder(row, grouped.get(row.id) ?? []));
}

export function insertOrder(
  database: Database,
  customer: Customer,
  quote: CartQuote,
  note: string,
  timestamp: string,
): Order {
  const id = `order-${randomUUID()}`;
  const totals = quote.totals;
  database.prepare(`
    INSERT INTO orders (
      id, customer_id, customer_name, customer_email, customer_company, locale, status,
      subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code,
      note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, customer.id, customer.name, customer.email, customer.company, quote.locale,
    totals.subtotalCents, totals.discountCents, totals.shippingCents, totals.totalCents,
    quote.coupon?.code ?? null, note, timestamp, timestamp,
  );
  const insertLine = database.prepare(`
    INSERT INTO order_items (
      order_id, line_index, product_id, sku, name, category, quantity, unit_price_cents,
      line_subtotal_cents, discount_cents, line_total_cents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  quote.items.forEach((item, index) => {
    insertLine.run(
      id, index, item.productId, item.sku, item.name, item.category,
      item.quantity, item.unitPriceCents, item.lineSubtotalCents, item.discountCents, item.lineTotalCents,
    );
  });
  return getOrder(database, id);
}
