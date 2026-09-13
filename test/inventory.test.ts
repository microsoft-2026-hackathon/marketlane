import assert from "node:assert/strict";
import test from "node:test";
import { getProduct } from "../server/catalog/repository.js";
import { adjustInventory } from "../server/inventory/service.js";
import { placeOrder } from "../server/orders/service.js";
import { counts, databaseFixture, lampCart } from "./helpers.js";

test("stock adjustments and checkout keep the movement ledger balanced", t => {
  const { database, clock } = databaseFixture(t);
  adjustInventory(database, { productId: "product-arc-lamp", delta: 7, reason: "Supplier receipt", reference: "PO-42" }, clock);
  adjustInventory(database, { productId: "product-arc-lamp", delta: -2, reason: "Damaged in transit" }, clock);
  placeOrder(database, lampCart, "en", clock);
  const rows = database.prepare<[], { stock: number; ledger: number }>(`
    SELECT i.stock_on_hand AS stock, COALESCE(sum(m.delta), 0) AS ledger
    FROM inventory i LEFT JOIN inventory_movements m ON m.product_id = i.product_id GROUP BY i.product_id
  `).all();
  assert.ok(rows.every(row => row.stock === row.ledger));
});

test("oversized negative adjustments and unknown products leave the ledger unchanged", t => {
  const { database, clock } = databaseFixture(t);
  const before = counts(database);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  assert.throws(() => adjustInventory(database, { productId: "product-arc-lamp", delta: -100, reason: "Recount correction" }, clock), {
    code: "INSUFFICIENT_STOCK",
  });
  assert.throws(() => adjustInventory(database, { productId: "missing", delta: 2, reason: "Supplier receipt" }, clock), { code: "NOT_FOUND" });
  assert.deepEqual(counts(database), before);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, stock);
});

test("an inventory ledger write failure also rolls back its stock update", t => {
  const { database, clock } = databaseFixture(t);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  database.exec(`
    CREATE TRIGGER reject_adjustment BEFORE INSERT ON inventory_movements
    BEGIN SELECT RAISE(ABORT, 'ledger unavailable'); END;
  `);
  assert.throws(() => adjustInventory(database, { productId: "product-arc-lamp", delta: 2, reason: "Supplier receipt" }, clock), /ledger unavailable/);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, stock);
});
