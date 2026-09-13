import assert from "node:assert/strict";
import test from "node:test";
import type { CartLine } from "../shared/contracts.js";
import {
  addCartLine,
  cartStorageKey,
  decodeStoredCart,
  encodeStoredCart,
  itemCount,
  MAX_CART_LINES,
  MAX_QUANTITY,
  quantityFromInput,
  quoteDraftKey,
  removeCartLine,
  sameCartLines,
  setLineQuantity,
  validateCartLines,
} from "../client/src/lib/cart-state.js";
import {
  formatMoney,
  parsePriceCents,
  parseStockDelta,
  priceInputValue,
  stockDeltaFromInput,
} from "../client/src/lib/money.js";

const lamp: CartLine = { productId: "product-arc-lamp", quantity: 2 };
const notebook: CartLine = { productId: "product-pocket-notebook", quantity: 1 };

test("a missing saved cart is empty, while malformed content is an explicit recovery result", () => {
  assert.deepEqual(decodeStoredCart(null), { ok: true, items: [] });
  assert.deepEqual(decodeStoredCart("[]"), { ok: true, items: [] });
  for (const raw of ["", "{", "null", "42", "{}", '{"items":[]}']) {
    const result = decodeStoredCart(raw);
    assert.equal(result.ok, false, raw);
    if (!result.ok) assert.ok(result.message.length > 0);
  }
});

test("saved carts contain only unique product IDs and positive whole quantities", () => {
  const invalid: unknown[] = [
    [{ productId: "product-arc-lamp", quantity: 0 }],
    [{ productId: "product-arc-lamp", quantity: -1 }],
    [{ productId: "product-arc-lamp", quantity: 1.5 }],
    [{ productId: "product-arc-lamp", quantity: 100 }],
    [{ productId: "product-arc-lamp", quantity: "2" }],
    [{ productId: "product-arc-lamp", quantity: 1, priceCents: 6800 }],
    [{ productId: "product-arc-lamp", quantity: 1, name: "Stored label" }],
    [{ productId: " product-arc-lamp", quantity: 1 }],
    [{ productId: "", quantity: 1 }],
    [{ productId: "x".repeat(101), quantity: 1 }],
    [{ productId: "product-\ud800", quantity: 1 }],
    [{ productId: "product-\u0000", quantity: 1 }],
    [lamp, lamp],
    [null],
    [[]],
  ];
  for (const items of invalid) {
    assert.equal(validateCartLines(items), false);
    assert.equal(decodeStoredCart(JSON.stringify(items)).ok, false);
  }
  assert.equal(validateCartLines([{ productId: "unknown-but-valid-id", quantity: 99 }]), true);
});

test("cart persistence round-trips IDs and quantities without retaining pricing data", () => {
  const items = [lamp, notebook];
  assert.equal(encodeStoredCart(items), '[{"productId":"product-arc-lamp","quantity":2},{"productId":"product-pocket-notebook","quantity":1}]');
  assert.deepEqual(decodeStoredCart(encodeStoredCart(items)), { ok: true, items });
  assert.deepEqual(items, [lamp, notebook]);
  assert.throws(() => encodeStoredCart([{ productId: lamp.productId, quantity: 0 }]));
});

test("storage keys isolate customer drafts and encode potentially significant characters", () => {
  assert.notEqual(cartStorageKey("customer-ava"), cartStorageKey("customer-min"));
  assert.equal(cartStorageKey("customer-ava"), "marketlane.cart.v1:customer-ava");
  assert.equal(cartStorageKey("customer/a:b"), "marketlane.cart.v1:customer%2Fa%3Ab");
  assert.throws(() => cartStorageKey(""));
});

test("adding, changing, and removing lines is immutable and maintains one line per product", () => {
  const original = [lamp, notebook];
  const added = addCartLine(original, lamp.productId, 3);
  assert.deepEqual(added, [{ productId: lamp.productId, quantity: 5 }, notebook]);
  assert.deepEqual(original, [lamp, notebook]);
  assert.deepEqual(setLineQuantity(original, notebook.productId, 4), [lamp, { productId: notebook.productId, quantity: 4 }]);
  assert.deepEqual(removeCartLine(original, lamp.productId), [notebook]);
  assert.equal(itemCount(original), 3);
  assert.equal(itemCount([]), 0);
  assert.deepEqual(original, [lamp, notebook]);
});

test("cart quantity and distinct-product boundaries reject invalid edits instead of clamping", () => {
  const full = Array.from({ length: MAX_CART_LINES }, (_, index) => ({ productId: `product-${index}`, quantity: 1 }));
  assert.equal(validateCartLines(full), true);
  assert.equal(validateCartLines([...full, { productId: "another", quantity: 1 }]), false);
  assert.throws(() => addCartLine(full, "another"));
  assert.equal(setLineQuantity(full, "product-0", MAX_QUANTITY)[0]?.quantity, MAX_QUANTITY);
  assert.throws(() => addCartLine([{ productId: lamp.productId, quantity: MAX_QUANTITY }], lamp.productId));
  for (const quantity of [0, -1, 1.5, 100, NaN, Infinity]) {
    assert.throws(() => setLineQuantity([lamp], lamp.productId, quantity));
  }
  assert.throws(() => addCartLine([lamp], notebook.productId, 0));
});

test("in-progress quantity fields cannot be mistaken for valid draft quantities", () => {
  for (const text of ["", " ", "0", "-1", "1.5", "1e1", "100", "2 items", "NaN"]) {
    assert.equal(quantityFromInput(text), null, text);
  }
  assert.equal(quantityFromInput("1"), 1);
  assert.equal(quantityFromInput("99"), 99);
  assert.equal(quantityFromInput(" 12 "), 12);
});

test("quote identities change with every pricing context, not just the visible catalog", () => {
  const key = quoteDraftKey("customer-ava", "en", [lamp], "");
  assert.notEqual(key, quoteDraftKey("customer-min", "en", [lamp], ""));
  assert.notEqual(key, quoteDraftKey("customer-ava", "ko", [lamp], ""));
  assert.notEqual(key, quoteDraftKey("customer-ava", "en", [lamp], "WELCOME10"));
  assert.notEqual(key, quoteDraftKey("customer-ava", "en", [{ ...lamp, quantity: 3 }], ""));
  assert.notEqual(key, quoteDraftKey("customer-ava", "en", [lamp, notebook], ""));
  assert.equal(key, quoteDraftKey("customer-ava", "en", [{ ...lamp }], ""));
});

test("quote and order line matching rejects missing, duplicate, or changed submitted items", () => {
  assert.equal(sameCartLines([lamp, notebook], [notebook, lamp]), true);
  assert.equal(sameCartLines([lamp], [notebook]), false);
  assert.equal(sameCartLines([lamp], [{ ...lamp, quantity: 3 }]), false);
  assert.equal(sameCartLines([lamp, lamp], [lamp, notebook]), false);
  assert.equal(sameCartLines([lamp, notebook], [lamp, lamp]), false);
  assert.equal(sameCartLines([lamp, notebook], [lamp]), false);
});

test("USD input parsing uses whole cents without floating-point rounding", () => {
  for (const [input, expected] of [
    ["0.01", 1], ["0.29", 29], ["1", 100], ["1.2", 120], ["19.99", 1999], [" 68.00 ", 6800],
    ["0007.05", 705], ["99999.99", 9_999_999], ["100000.00", 10_000_000],
  ] as const) assert.equal(parsePriceCents(input), expected, input);
});

test("USD input rejects fractional cents, unsupported syntax, and prices outside API bounds", () => {
  for (const input of ["", ".", ".99", "1.", "1.005", "-1", "+1", "1e3", "$12", "1,000", "NaN", "Infinity", "0", "0.00", "100000.01", "9007199254740991"]) {
    assert.throws(() => parsePriceCents(input), Error, input);
  }
});

test("price fields and currency formatting keep USD amounts exact", () => {
  assert.equal(priceInputValue(29), "0.29");
  assert.equal(priceInputValue(6800), "68.00");
  assert.equal(parsePriceCents(priceInputValue(9999)), 9999);
  assert.equal(formatMoney(6800), "$68.00");
  assert.equal(formatMoney(29), "$0.29");
  assert.equal(formatMoney(0), "$0.00");
  assert.throws(() => formatMoney(10.5));
  assert.throws(() => priceInputValue(-1));
});

test("inventory adjustments parse deliberate nonzero integer deltas within API limits", () => {
  assert.equal(parseStockDelta("+12"), 12);
  assert.equal(parseStockDelta(" -3 "), -3);
  assert.equal(parseStockDelta("10000"), 10000);
  assert.equal(parseStockDelta("-10000"), -10000);
  for (const input of ["", "0", "-0", "+0", "1.5", "2e2", "stock", "10001", "-10001", "Infinity"]) {
    assert.equal(stockDeltaFromInput(input), null);
    assert.throws(() => parseStockDelta(input));
  }
});
