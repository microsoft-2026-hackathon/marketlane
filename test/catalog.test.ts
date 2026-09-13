import assert from "node:assert/strict";
import test from "node:test";
import { allProducts, getProduct, listCatalog, updateProduct } from "../server/catalog/repository.js";
import { seedDatabase } from "../server/db/seed.js";
import { adjustInventory } from "../server/inventory/service.js";
import { counts, databaseFixture } from "./helpers.js";

test("the catalog and seed marker are stable across repeated initialization", t => {
  const { database, clock } = databaseFixture(t);
  const initialCounts = counts(database);
  assert.equal(allProducts(database).length, 18);
  seedDatabase(database, clock);
  assert.deepEqual(counts(database), initialCounts);
  assert.equal(allProducts(database).length, 18);
});

test("Korean content is selected explicitly and missing content falls back to English", t => {
  const { database } = databaseFixture(t);
  const english = getProduct(database, "product-arc-lamp", "en");
  const korean = getProduct(database, english.id, "ko");
  assert.notEqual(korean.name, english.name);
  assert.equal(korean.contentLocale, "ko");
  assert.equal(korean.priceCents, english.priceCents);
  const fallback = getProduct(database, "product-refill-pages", "ko");
  assert.equal(fallback.locale, "ko");
  assert.equal(fallback.contentLocale, "en");
  assert.equal(fallback.name, getProduct(database, fallback.id).name);
});

test("all price-sorted pages include ties exactly once", t => {
  const { database } = databaseFixture(t);
  const products = Array.from({ length: 6 }, (_, index) =>
    listCatalog(database, { sort: "price-asc", page: index + 1, pageSize: 3 }).items,
  ).flat();
  assert.equal(products.length, 18);
  assert.equal(new Set(products.map(product => product.id)).size, 18);
  assert.deepEqual(products.map(product => product.priceCents), products.map(product => product.priceCents).sort((a, b) => a - b));
  assert.equal(listCatalog(database, { page: 20 }).items.length, 0);
});

test("search uses localized display text and treats SQL wildcard characters literally", t => {
  const { database, clock } = databaseFixture(t);
  const original = getProduct(database, "product-refill-pages");
  updateProduct(database, original.id, {
    locale: "en", name: "Grid_100% refill", description: original.description,
    priceCents: original.priceCents, featured: false,
  }, clock);
  assert.deepEqual(listCatalog(database, { q: "%" }).items.map(item => item.id), [original.id]);
  assert.deepEqual(listCatalog(database, { q: "_" }).items.map(item => item.id), [original.id]);
  assert.equal(listCatalog(database, { q: "' OR 1=1 --" }).total, 0);
  assert.ok(listCatalog(database, { locale: "ko", q: "램프" }).total >= 1);
});

test("filters compose and stock changes are visible on the next catalog read", t => {
  const { database, clock } = databaseFixture(t);
  const query = { category: "carry", inStock: "true", pageSize: 24 };
  assert.equal(listCatalog(database, query).total, 5);
  adjustInventory(database, { productId: "product-travel-bottle", delta: 3, reason: "Supplier receipt" }, clock);
  assert.equal(listCatalog(database, query).total, 6);
  assert.equal(listCatalog(database, query).items.find(item => item.id === "product-travel-bottle")?.stockOnHand, 3);
});

test("localized edits do not overwrite the other translation", t => {
  const { database, clock } = databaseFixture(t);
  const original = getProduct(database, "product-arc-lamp");
  clock.set("2026-09-14T01:02:03.000Z");
  const changed = updateProduct(database, original.id, {
    locale: "ko", name: "새로운 아크 램프", description: "책상 위를 밝히는 새로운 설명입니다.",
    priceCents: 7100, featured: false,
  }, clock);
  assert.equal(changed.updatedAt, clock.now().toISOString());
  assert.equal(getProduct(database, original.id).name, original.name);
  assert.equal(getProduct(database, original.id).priceCents, 7100);
  assert.equal(changed.featured, false);
});
