import { randomUUID } from "node:crypto";
import type { CheckoutRequest } from "../../shared/contracts.js";
import type { Clock } from "../domain/clock.js";
import { systemClock } from "../domain/clock.js";
import { changeOrderStatus, placeOrder } from "../orders/service.js";
import { initialCatalog } from "./catalog-data.js";
import type { Database } from "./database.js";

export function seedDatabase(database: Database, clock: Clock = systemClock): void {
  database.transaction(() => {
    if (database.prepare("SELECT value FROM app_metadata WHERE key = 'seeded_at'").get()) return;
    const count = database.prepare<[], { count: number }>("SELECT count(*) AS count FROM products").get()!.count;
    if (count !== 0) throw new Error("An unmarked catalog already exists; refusing to overwrite it.");
    const now = clock.now().getTime();
    for (const [index, product] of initialCatalog.entries()) {
      const id = `product-${product.slug}`;
      const created = new Date(now - (24 - index) * 86_400_000).toISOString();
      database.prepare(`
        INSERT INTO products (id, sku, slug, category, price_cents, featured, tone, shape, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, product.sku, product.slug, product.category, product.priceCents,
        product.featured ? 1 : 0, product.tone, product.shape, created, created,
      );
      const translation = database.prepare(`
        INSERT INTO product_translations (product_id, locale, name, description) VALUES (?, ?, ?, ?)
      `);
      translation.run(id, "en", product.name, product.description);
      if (product.korean) translation.run(id, "ko", product.korean.name, product.korean.description);
      database.prepare(`
        INSERT INTO inventory (product_id, stock_on_hand, low_stock_threshold, updated_at) VALUES (?, ?, 5, ?)
      `).run(id, product.stock, created);
      if (product.stock > 0) {
        database.prepare(`
          INSERT INTO inventory_movements (id, product_id, delta, reason, reference, created_at)
          VALUES (?, ?, ?, 'Opening balance', 'opening-balance', ?)
        `).run(randomUUID(), id, product.stock, created);
      }
    }
    const customer = database.prepare("INSERT INTO customers (id, name, email, company) VALUES (?, ?, ?, ?)");
    customer.run("customer-ava", "Ava Morgan", "ava@example.com", "North Studio");
    customer.run("customer-min", "Min Park", "min@example.com", "Form Office");
    customer.run("customer-jules", "Jules Rivera", "jules@example.com", "Fieldworks");
    database.prepare("INSERT INTO coupons (code, percent, min_subtotal_cents, active) VALUES ('WELCOME10', 10, 5000, 1)").run();
    const orders: { days: number; locale: "en" | "ko"; state: "placed" | "packing" | "shipped"; request: CheckoutRequest }[] = [
      {
        days: 9, locale: "en", state: "shipped",
        request: { customerId: "customer-ava", items: [{ productId: "product-felt-desk-mat", quantity: 2 }], couponCode: "WELCOME10", note: "For the two new desks." },
      },
      {
        days: 5, locale: "ko", state: "shipped",
        request: { customerId: "customer-min", items: [{ productId: "product-arc-lamp", quantity: 1 }, { productId: "product-dot-grid-notebook", quantity: 3 }], couponCode: "WELCOME10" },
      },
      {
        days: 2, locale: "en", state: "packing",
        request: { customerId: "customer-jules", items: [{ productId: "product-weekender-bag", quantity: 1 }, { productId: "product-steel-bottle", quantity: 1 }], note: "Keep these together in one parcel." },
      },
      {
        days: 1, locale: "en", state: "placed",
        request: { customerId: "customer-ava", items: [{ productId: "product-brass-pen", quantity: 2 }, { productId: "product-dot-grid-notebook", quantity: 1 }], couponCode: "WELCOME10" },
      },
      {
        days: 0, locale: "ko", state: "placed",
        request: { customerId: "customer-min", items: [{ productId: "product-weekly-planner", quantity: 1 }, { productId: "product-commuter-sleeve", quantity: 1 }] },
      },
    ];
    for (const item of orders) {
      const placed = now - item.days * 86_400_000 - 2 * 3_600_000;
      const order = placeOrder(database, item.request, item.locale, { now: () => new Date(placed) });
      if (item.state !== "placed") {
        changeOrderStatus(database, order.id, { status: "packing" }, { now: () => new Date(placed + 1_800_000) });
      }
      if (item.state === "shipped") {
        changeOrderStatus(database, order.id, { status: "shipped" }, { now: () => new Date(placed + 3_600_000) });
      }
    }
    database.prepare("INSERT INTO app_metadata (key, value) VALUES ('seeded_at', ?)").run(new Date(now).toISOString());
  }).immediate();
}
