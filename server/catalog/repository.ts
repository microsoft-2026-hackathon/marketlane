import type {
  CatalogPage, Category, Locale, Product, ProductShape, ProductTone,
} from "../../shared/contracts.js";
import type { Database } from "../db/database.js";
import type { Clock } from "../domain/clock.js";
import { notFound } from "../domain/errors.js";
import { catalogQuerySchema, productUpdateSchema } from "../domain/validation.js";

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  price_cents: number;
  stock_on_hand: number;
  low_stock_threshold: number;
  featured: number;
  tone: ProductTone;
  shape: ProductShape;
  content_locale: Locale;
  created_at: string;
  updated_at: string;
}

const projection = `
  SELECT p.*, COALESCE(t.name, english.name) AS name,
    COALESCE(t.description, english.description) AS description,
    CASE WHEN t.product_id IS NULL THEN 'en' ELSE @locale END AS content_locale,
    i.stock_on_hand, i.low_stock_threshold
  FROM products p
  JOIN product_translations english ON english.product_id = p.id AND english.locale = 'en'
  LEFT JOIN product_translations t ON t.product_id = p.id AND t.locale = @locale
  JOIN inventory i ON i.product_id = p.id
`;

function toProduct(row: ProductRow, locale: Locale): Product {
  return {
    id: row.id, sku: row.sku, slug: row.slug,
    name: row.name, description: row.description, category: row.category,
    priceCents: row.price_cents, stockOnHand: row.stock_on_hand,
    lowStockThreshold: row.low_stock_threshold, featured: row.featured === 1,
    tone: row.tone, shape: row.shape, locale, contentLocale: row.content_locale,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function getProduct(database: Database, id: string, locale: Locale = "en"): Product {
  const row = database.prepare<{ id: string; locale: Locale }, ProductRow>(
    `${projection} WHERE p.id = @id`,
  ).get({ id, locale });
  if (!row) notFound("Product");
  return toProduct(row, locale);
}

export function allProducts(database: Database, locale: Locale = "en"): Product[] {
  return database.prepare<{ locale: Locale }, ProductRow>(
    `${projection} ORDER BY p.category, p.sku`,
  ).all({ locale }).map(row => toProduct(row, locale));
}

export function listCatalog(database: Database, input: unknown): CatalogPage {
  const query = catalogQuerySchema.parse(input);
  const parameters = {
    locale: query.locale,
    query: query.q,
    category: query.category ?? null,
    inStock: query.inStock ? 1 : 0,
  };
  const filter = `
    WHERE (@category IS NULL OR p.category = @category)
      AND (@inStock = 0 OR i.stock_on_hand > 0)
      AND (@query = '' OR instr(lower(COALESCE(t.name, english.name)), lower(@query)) > 0
        OR instr(lower(COALESCE(t.description, english.description)), lower(@query)) > 0
        OR instr(lower(p.sku), lower(@query)) > 0)
  `;
  const orderBy = {
    featured: "p.featured DESC, p.created_at DESC, p.id ASC",
    "price-asc": "p.price_cents ASC, p.id ASC",
    "price-desc": "p.price_cents DESC, p.id ASC",
    name: "name COLLATE NOCASE ASC, p.id ASC",
  }[query.sort];
  const count = database.prepare<typeof parameters, { count: number }>(
    `SELECT count(*) AS count FROM (${projection} ${filter})`,
  ).get(parameters)!.count;
  const pageParameters = { ...parameters, limit: query.pageSize, offset: (query.page - 1) * query.pageSize };
  const items = database.prepare<typeof pageParameters, ProductRow>(
    `${projection} ${filter} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`,
  ).all(pageParameters).map(row => toProduct(row, query.locale));
  return {
    items, total: count, page: query.page, pageSize: query.pageSize,
    pageCount: Math.ceil(count / query.pageSize),
  };
}

export function updateProduct(database: Database, id: string, input: unknown, clock: Clock): Product {
  const update = productUpdateSchema.parse(input);
  return database.transaction(() => {
    getProduct(database, id);
    database.prepare(`
      UPDATE products SET price_cents = ?, featured = ?, updated_at = ? WHERE id = ?
    `).run(update.priceCents, update.featured ? 1 : 0, clock.now().toISOString(), id);
    database.prepare(`
      INSERT INTO product_translations (product_id, locale, name, description) VALUES (?, ?, ?, ?)
      ON CONFLICT (product_id, locale) DO UPDATE SET name = excluded.name, description = excluded.description
    `).run(id, update.locale, update.name, update.description);
    return getProduct(database, id, update.locale);
  }).immediate();
}
