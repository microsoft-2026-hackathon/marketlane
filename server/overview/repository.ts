import type { Category, Overview } from "../../shared/contracts.js";
import type { Database } from "../db/database.js";
import { listOrders } from "../orders/repository.js";

export function getOverview(database: Database): Overview {
  return database.transaction(() => {
    const stats = database.prepare<[], {
      productCount: number;
      lowStockCount: number;
      openOrderCount: number;
      bookedSalesCents: number;
    }>(`
      SELECT
        (SELECT count(*) FROM products) AS productCount,
        (SELECT count(*) FROM inventory WHERE stock_on_hand <= low_stock_threshold) AS lowStockCount,
        (SELECT count(*) FROM orders WHERE status != 'shipped') AS openOrderCount,
        (SELECT COALESCE(sum(total_cents), 0) FROM orders) AS bookedSalesCents
    `).get()!;
    const categorySales = database.prepare<[], { category: Category; units: number; revenueCents: number }>(`
      SELECT category, sum(quantity) AS units, sum(line_total_cents) AS revenueCents
      FROM order_items GROUP BY category ORDER BY revenueCents DESC, category
    `).all();
    return { ...stats, categorySales, recentOrders: listOrders(database, { limit: 5 }) };
  })();
}
