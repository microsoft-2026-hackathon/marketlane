import assert from "node:assert/strict";
import test from "node:test";
import { getProduct, updateProduct } from "../server/catalog/repository.js";
import { inventoryState } from "../server/inventory/service.js";
import { getOrder } from "../server/orders/repository.js";
import { changeOrderStatus, placeOrder, quoteCart } from "../server/orders/service.js";
import { counts, databaseFixture, lampCart } from "./helpers.js";

test("checkout stores quote totals and one matching inventory movement per line", t => {
  const { database, clock } = databaseFixture(t);
  const before = counts(database);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  const request = { ...lampCart, couponCode: "WELCOME10", note: "Leave at reception." };
  const quote = quoteCart(database, requestWithoutNote(request), "en", clock);
  const order = placeOrder(database, request, "en", clock);
  assert.deepEqual(order.totals, quote.totals);
  assert.equal(order.number, "ML-1006");
  assert.equal(order.status, "placed");
  assert.equal(order.note, request.note);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, stock - 1);
  assert.deepEqual(counts(database), { orders: before.orders + 1, lines: before.lines + 1, movements: before.movements + 1 });
  const movement = inventoryState(database, "en").movements.find(item => item.reference === order.id);
  assert.equal(movement?.delta, -1);
});

function requestWithoutNote(request: typeof lampCart & { couponCode: string; note: string }) {
  return { customerId: request.customerId, items: request.items, couponCode: request.couponCode };
}

test("historical lines and customer details survive later catalog and customer edits", t => {
  const { database, clock } = databaseFixture(t);
  const original = getProduct(database, "product-arc-lamp");
  const order = placeOrder(database, lampCart, "en", clock);
  updateProduct(database, original.id, {
    locale: "en", name: "Renamed lamp", description: "A revised catalog description.",
    priceCents: 9900, featured: false,
  }, clock);
  database.prepare("UPDATE customers SET name = 'New account name', company = 'New company' WHERE id = ?").run(order.customer.id);
  assert.deepEqual(getOrder(database, order.id), order);
  assert.equal(getOrder(database, order.id).items[0]?.name, original.name);
});

test("checkout reloads pricing instead of trusting an earlier quote", t => {
  const { database, clock } = databaseFixture(t);
  const oldQuote = quoteCart(database, lampCart, "en", clock);
  database.prepare("UPDATE products SET price_cents = 7000 WHERE id = ?").run("product-arc-lamp");
  const order = placeOrder(database, lampCart, "en", clock);
  assert.notEqual(order.totals.totalCents, oldQuote.totals.totalCents);
  assert.equal(order.items[0]?.unitPriceCents, 7000);
});

test("a later stock-write failure rolls back the entire checkout", t => {
  const { database, clock } = databaseFixture(t);
  const before = counts(database);
  const firstStock = getProduct(database, "product-arc-lamp").stockOnHand;
  const secondStock = getProduct(database, "product-felt-desk-mat").stockOnHand;
  database.exec(`
    CREATE TRIGGER reject_mat_movement BEFORE INSERT ON inventory_movements
    WHEN NEW.product_id = 'product-felt-desk-mat'
    BEGIN SELECT RAISE(ABORT, 'movement write unavailable'); END;
  `);
  assert.throws(() => placeOrder(database, {
    customerId: "customer-ava",
    items: [{ productId: "product-arc-lamp", quantity: 1 }, { productId: "product-felt-desk-mat", quantity: 1 }],
  }, "en", clock), /movement write unavailable/);
  assert.deepEqual(counts(database), before);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, firstStock);
  assert.equal(getProduct(database, "product-felt-desk-mat").stockOnHand, secondStock);
});

test("fulfillment transitions are ordered, repeatable, and never decrement stock again", t => {
  const { database, clock } = databaseFixture(t);
  const order = placeOrder(database, lampCart, "en", clock);
  const afterCheckout = counts(database);
  assert.throws(() => changeOrderStatus(database, order.id, { status: "shipped" }, clock), { code: "INVALID_ORDER_TRANSITION" });
  clock.set("2026-09-13T13:00:00.000Z");
  const packing = changeOrderStatus(database, order.id, { status: "packing" }, clock);
  assert.equal(packing.packedAt, clock.now().toISOString());
  clock.set("2026-09-13T14:00:00.000Z");
  assert.deepEqual(changeOrderStatus(database, order.id, { status: "packing" }, clock), packing);
  const shipped = changeOrderStatus(database, order.id, { status: "shipped" }, clock);
  assert.equal(shipped.shippedAt, clock.now().toISOString());
  assert.equal(shipped.packedAt, packing.packedAt);
  assert.throws(() => changeOrderStatus(database, order.id, { status: "packing" }, clock), { code: "INVALID_ORDER_TRANSITION" });
  assert.deepEqual(counts(database), afterCheckout);
});
