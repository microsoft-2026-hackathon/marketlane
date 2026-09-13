import assert from "node:assert/strict";
import test from "node:test";
import type { ApiErrorPayload, CartQuote, CatalogPage, Order, Overview, Product } from "../shared/contracts.js";
import { getProduct } from "../server/catalog/repository.js";
import { adjustInventory } from "../server/inventory/service.js";
import { appFixture, counts, lampCart } from "./helpers.js";

test("public HTTP routes expose the seeded catalog and operational totals", async t => {
  const { app } = await appFixture(t);
  for (const url of ["/api/health", "/api/config", "/api/customers", "/api/inventory", "/api/orders"]) {
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 200, url);
  }
  const catalog = (await app.inject("/api/catalog?locale=ko&pageSize=3")).json<CatalogPage>();
  assert.equal(catalog.total, 18);
  assert.equal(catalog.items.length, 3);
  assert.equal(catalog.pageCount, 6);
  const overview = (await app.inject("/api/overview")).json<Overview>();
  assert.equal(overview.productCount, 18);
  assert.equal(overview.openOrderCount, 3);
  assert.equal(overview.recentOrders.length, 5);
  const orders = (await app.inject("/api/orders")).json<{ items: Order[] }>().items;
  assert.equal(overview.bookedSalesCents, orders.reduce((total, order) => total + order.totals.totalCents, 0));
});

test("quote and checkout HTTP responses use shared shapes and server-authoritative prices", async t => {
  const { app } = await appFixture(t);
  const quoteResponse = await app.inject({ method: "POST", url: "/api/quotes?locale=ko", payload: lampCart });
  assert.equal(quoteResponse.statusCode, 200);
  const quote = quoteResponse.json<CartQuote>();
  const orderResponse = await app.inject({ method: "POST", url: "/api/orders?locale=ko", payload: lampCart });
  assert.equal(orderResponse.statusCode, 201);
  const { order } = orderResponse.json<{ order: Order }>();
  assert.deepEqual(order.totals, quote.totals);
  assert.equal(order.items[0]?.name, quote.items[0]?.name);
  const detail = await app.inject(`/api/orders/${order.id}`);
  assert.deepEqual(detail.json<{ order: Order }>().order, order);
  assert.equal(detail.headers["cache-control"], "no-store");
});

test("invalid quantities, unknown body fields, and duplicate lines are rejected before writes", async t => {
  const { app, database } = await appFixture(t);
  const before = counts(database);
  const payloads: Record<string, unknown>[] = [
    { ...lampCart, items: [] },
    { ...lampCart, items: [{ productId: "product-arc-lamp", quantity: 0 }] },
    { ...lampCart, items: [{ productId: "product-arc-lamp", quantity: 1.5 }] },
    { ...lampCart, items: [{ productId: "product-arc-lamp", quantity: 100 }] },
    { ...lampCart, items: [lampCart.items[0], lampCart.items[0]] },
    { ...lampCart, totalCents: 1 },
    { ...lampCart, items: [{ ...lampCart.items[0], unitPriceCents: 1 }] },
  ];
  for (const payload of payloads) {
    const response = await app.inject({ method: "POST", url: "/api/orders", payload });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(typeof response.json<ApiErrorPayload>().error.code, "string");
  }
  assert.deepEqual(counts(database), before);
});

test("unknown customers and products produce not-found errors, not partial orders", async t => {
  const { app, database } = await appFixture(t);
  const before = counts(database);
  for (const payload of [
    { ...lampCart, customerId: "missing-customer" },
    { ...lampCart, items: [{ productId: "missing-product", quantity: 1 }] },
  ]) {
    const response = await app.inject({ method: "POST", url: "/api/orders", payload });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json<ApiErrorPayload>().error.code, "NOT_FOUND");
  }
  assert.deepEqual(counts(database), before);
});

test("catalog and order filters reject invalid query values", async t => {
  const { app } = await appFixture(t);
  for (const url of [
    "/api/catalog?page=0", "/api/catalog?pageSize=25", "/api/catalog?locale=ja",
    "/api/catalog?sort=invalid", "/api/catalog?inStock=1", "/api/catalog?extra=1",
    "/api/orders?limit=1000", "/api/orders?status=cancelled",
  ]) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 400, url);
    assert.equal(response.json<ApiErrorPayload>().error.code, "VALIDATION_ERROR");
  }
});

test("malformed and oversized request bodies keep the structured error envelope", async t => {
  const { app } = await appFixture(t);
  const malformed = await app.inject({
    method: "POST", url: "/api/orders", headers: { "content-type": "application/json" }, payload: "{",
  });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json<ApiErrorPayload>().error.code, "INVALID_REQUEST");
  const oversized = await app.inject({
    method: "POST", url: "/api/orders", payload: { ...lampCart, note: "x".repeat(70_000) },
  });
  assert.equal(oversized.statusCode, 413);
  assert.equal(oversized.json<ApiErrorPayload>().error.code, "INVALID_REQUEST");
  const missing = await app.inject("/api/not-a-route");
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json<ApiErrorPayload>().error.code, "NOT_FOUND");
});

test("mutations accept the local UI origin and reject unrelated browser origins", async t => {
  const { app, database } = await appFixture(t);
  const before = counts(database);
  const forbidden = await app.inject({
    method: "POST", url: "/api/orders", payload: lampCart,
    headers: { origin: "https://unrelated.example.com" },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.deepEqual(counts(database), before);
  const allowed = await app.inject({
    method: "POST", url: "/api/quotes", payload: lampCart,
    headers: { origin: "http://127.0.0.1:5178" },
  });
  assert.equal(allowed.statusCode, 200);
});

test("competing checkouts cannot oversell the final unit", async t => {
  const { app, database, clock } = await appFixture(t);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  adjustInventory(database, { productId: "product-arc-lamp", delta: 1 - stock, reason: "Stock recount" }, clock);
  const before = counts(database);
  const responses = await Promise.all(Array.from({ length: 12 }, () =>
    app.inject({ method: "POST", url: "/api/orders", payload: lampCart }),
  ));
  assert.equal(responses.filter(response => response.statusCode === 201).length, 1);
  assert.equal(responses.filter(response => response.statusCode === 409).length, 11);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, 0);
  assert.equal(counts(database).orders, before.orders + 1);
});

test("operator edits and inventory adjustments return updated product state", async t => {
  const { app } = await appFixture(t);
  const patch = await app.inject({
    method: "PATCH", url: "/api/products/product-refill-pages",
    payload: { locale: "ko", name: "리필 내지", description: "A5 바인더에 맞는 줄 노트 내지입니다.", priceCents: 900, featured: true },
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.json<{ product: Product }>().product.contentLocale, "ko");
  const adjustment = await app.inject({
    method: "POST", url: "/api/inventory/adjustments",
    payload: { productId: "product-travel-bottle", delta: 4, reason: "Delivery received", reference: "PO-123" },
  });
  assert.equal(adjustment.statusCode, 201);
  assert.equal(adjustment.json<{ product: Product }>().product.stockOnHand, 4);
});

test("fulfillment HTTP routes reject skipped steps and expose accepted timestamps", async t => {
  const { app, clock } = await appFixture(t);
  const order = (await app.inject({ method: "POST", url: "/api/orders", payload: lampCart })).json<{ order: Order }>().order;
  const url = `/api/orders/${order.id}/status`;
  assert.equal((await app.inject({ method: "PATCH", url, payload: { status: "shipped" } })).statusCode, 409);
  clock.set("2026-09-14T12:00:00.000Z");
  const packed = await app.inject({ method: "PATCH", url, payload: { status: "packing" } });
  assert.equal(packed.json<{ order: Order }>().order.packedAt, clock.now().toISOString());
  const shipped = await app.inject({ method: "PATCH", url, payload: { status: "shipped" } });
  assert.equal(shipped.statusCode, 200);
  assert.equal(shipped.json<{ order: Order }>().order.status, "shipped");
});
