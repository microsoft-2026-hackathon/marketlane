import type { CartQuote, Customer, Locale, Order, QuoteRequest } from "../../shared/contracts.js";
import { getProduct } from "../catalog/repository.js";
import { getCustomer } from "../customers/repository.js";
import type { Database } from "../db/database.js";
import type { Clock } from "../domain/clock.js";
import { AppError } from "../domain/errors.js";
import { orderStatusSchema, parseCheckout, parseQuote } from "../domain/validation.js";
import { changeStock } from "../inventory/service.js";
import { priceCart } from "../pricing/pricing.js";
import { findCoupon } from "../pricing/repository.js";
import { getOrder, insertOrder } from "./repository.js";

function calculate(
  database: Database, request: QuoteRequest, locale: Locale, timestamp: string,
): { customer: Customer; quote: CartQuote } {
  const customer = getCustomer(database, request.customerId);
  const items = request.items.map(item => {
    const product = getProduct(database, item.productId, locale);
    if (product.stockOnHand < item.quantity) {
      throw new AppError(409, "INSUFFICIENT_STOCK", "There is not enough stock for this product.", {
        sku: product.sku, available: product.stockOnHand, requested: item.quantity,
      });
    }
    return { product, quantity: item.quantity };
  });
  const coupon = findCoupon(database, request.couponCode);
  const priced = priceCart(items, coupon);
  return {
    customer,
    quote: {
      currency: "USD", locale, ...priced,
      coupon: coupon ? { code: coupon.code, percent: coupon.percent } : null,
      quotedAt: timestamp,
    },
  };
}

export function quoteCart(database: Database, input: unknown, locale: Locale, clock: Clock): CartQuote {
  const request = parseQuote(input);
  return database.transaction(() => calculate(database, request, locale, clock.now().toISOString()).quote)();
}

export function placeOrder(database: Database, input: unknown, locale: Locale, clock: Clock): Order {
  const request = parseCheckout(input);
  return database.transaction(() => {
    const timestamp = clock.now().toISOString();
    const { customer, quote } = calculate(database, request, locale, timestamp);
    const order = insertOrder(database, customer, quote, request.note ?? "", timestamp);
    for (const item of quote.items) {
      changeStock(
        database, getProduct(database, item.productId, locale), -item.quantity,
        `Order ${order.number}`, order.id, timestamp,
      );
    }
    return order;
  }).immediate();
}

export function changeOrderStatus(database: Database, id: string, input: unknown, clock: Clock): Order {
  const { status } = orderStatusSchema.parse(input);
  return database.transaction(() => {
    const order = getOrder(database, id);
    if (order.status === status) return order;
    const allowed = (order.status === "placed" && status === "packing") ||
      (order.status === "packing" && status === "shipped");
    if (!allowed) {
      throw new AppError(409, "INVALID_ORDER_TRANSITION", "This fulfillment transition is not allowed.", {
        current: order.status, requested: status,
      });
    }
    const timestamp = clock.now().toISOString();
    const timestampColumn = status === "packing" ? "packed_at" : "shipped_at";
    database.prepare(`
      UPDATE orders SET status = ?, updated_at = ?, ${timestampColumn} = ?
      WHERE id = ? AND status = ?
    `).run(status, timestamp, timestamp, id, order.status);
    return getOrder(database, id);
  }).immediate();
}
