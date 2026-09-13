import assert from "node:assert/strict";
import test from "node:test";
import { getProduct } from "../server/catalog/repository.js";
import { priceCart } from "../server/pricing/pricing.js";
import { quoteCart } from "../server/orders/service.js";
import { counts, databaseFixture, lampCart } from "./helpers.js";

test("percentage discounts round down per line and totals reconcile", t => {
  const { database } = databaseFixture(t);
  const product = { ...getProduct(database, "product-arc-lamp"), priceCents: 101 };
  const result = priceCart([
    { product, quantity: 3 },
    { product: { ...product, id: "another-product" }, quantity: 1 },
  ], { code: "TEN", percent: 10, minSubtotalCents: 0 });
  assert.deepEqual(result.items.map(item => item.discountCents), [30, 10]);
  assert.deepEqual(result.totals, {
    subtotalCents: 404, discountCents: 40, shippingCents: 590, totalCents: 954,
  });
});

test("shipping thresholds use discounted merchandise, including the exact boundary", t => {
  const { database } = databaseFixture(t);
  const product = getProduct(database, "product-arc-lamp");
  const items = (priceCents: number) => [{ product: { ...product, priceCents }, quantity: 1 }];
  assert.equal(priceCart(items(9999), null).totals.shippingCents, 590);
  assert.equal(priceCart(items(10_000), null).totals.shippingCents, 0);
  assert.equal(priceCart(items(10_000), { code: "TEN", percent: 10, minSubtotalCents: 0 }).totals.shippingCents, 590);
  assert.equal(priceCart(items(11_111), { code: "TEN", percent: 10, minSubtotalCents: 0 }).totals.shippingCents, 0);
});

test("a quote normalizes coupon codes and leaves orders and inventory untouched", t => {
  const { database, clock } = databaseFixture(t);
  const before = counts(database);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  const quote = quoteCart(database, { ...lampCart, couponCode: " welcome10 " }, "ko", clock);
  assert.equal(quote.coupon?.code, "WELCOME10");
  assert.equal(quote.items[0]?.name, getProduct(database, "product-arc-lamp", "ko").name);
  assert.deepEqual(quote.totals, { subtotalCents: 6800, discountCents: 680, shippingCents: 590, totalCents: 6710 });
  assert.deepEqual(counts(database), before);
  assert.equal(getProduct(database, "product-arc-lamp").stockOnHand, stock);
});

test("unknown, inactive, and below-minimum coupons remain explicit failures", t => {
  const { database, clock } = databaseFixture(t);
  assert.throws(() => quoteCart(database, { ...lampCart, couponCode: "UNKNOWN" }, "en", clock), { code: "COUPON_UNAVAILABLE" });
  assert.throws(() => quoteCart(database, {
    customerId: "customer-ava", items: [{ productId: "product-pocket-notebook", quantity: 1 }], couponCode: "WELCOME10",
  }, "en", clock), { code: "COUPON_MINIMUM" });
  database.prepare("UPDATE coupons SET active = 0 WHERE code = 'WELCOME10'").run();
  assert.throws(() => quoteCart(database, { ...lampCart, couponCode: "WELCOME10" }, "en", clock), { code: "COUPON_UNAVAILABLE" });
});
