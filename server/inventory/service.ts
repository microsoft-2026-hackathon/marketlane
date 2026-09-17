import { randomUUID } from "node:crypto";
import type { InventoryMovement, InventoryState, Locale, Product } from "../../shared/contracts.js";
import { allProducts, getProduct } from "../catalog/repository.js";
import type { Database } from "../db/database.js";
import type { Clock } from "../domain/clock.js";
import { AppError } from "../domain/errors.js";
import { parseAdjustment } from "../domain/validation.js";

interface MovementRow {
  id: string;
  product_id: string;
  sku: string;
  delta: number;
  reason: string;
  reference: string | null;
  created_at: string;
}

export function inventoryState(database: Database, locale: Locale): InventoryState {
  const movements = database.prepare<[], MovementRow>(`
    SELECT m.*, p.sku FROM inventory_movements m JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 100
  `).all().map((row): InventoryMovement => ({
    id: row.id, productId: row.product_id, sku: row.sku, delta: row.delta,
    reason: row.reason, reference: row.reference, createdAt: row.created_at,
  }));
  return { items: allProducts(database, locale), movements };
}

// The caller owns the transaction that joins the stock change to its business operation.
export function changeStock(
  database: Database,
  product: Product,
  delta: number,
  reason: string,
  reference: string | null,
  timestamp: string,
): InventoryMovement {
  const result = database.prepare(`
    UPDATE inventory SET stock_on_hand = stock_on_hand + ?, updated_at = ?
    WHERE product_id = ? AND stock_on_hand + ? BETWEEN 0 AND 1000000
  `).run(delta, timestamp, product.id, delta);
  if (result.changes !== 1) {
    throw new AppError(409, delta < 0 ? "INSUFFICIENT_STOCK" : "STOCK_LIMIT", "재고 변경을 적용할 수 없습니다.", {
      sku: product.sku, available: getProduct(database, product.id).stockOnHand, requested: Math.abs(delta),
    });
  }
  const movement: InventoryMovement = {
    id: randomUUID(), productId: product.id, sku: product.sku, delta, reason, reference, createdAt: timestamp,
  };
  database.prepare(`
    INSERT INTO inventory_movements (id, product_id, delta, reason, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(movement.id, product.id, delta, reason, reference, timestamp);
  return movement;
}

export function adjustInventory(database: Database, input: unknown, clock: Clock): {
  product: Product;
  movement: InventoryMovement;
} {
  const adjustment = parseAdjustment(input);
  return database.transaction(() => {
    const product = getProduct(database, adjustment.productId);
    const movement = changeStock(
      database, product, adjustment.delta, adjustment.reason, adjustment.reference ?? null,
      clock.now().toISOString(),
    );
    return { product: getProduct(database, product.id), movement };
  }).immediate();
}
