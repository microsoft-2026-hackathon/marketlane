import type { Database } from "./database.js";

const migrations = [
  `
  CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('desk', 'carry', 'paper')),
    price_cents INTEGER NOT NULL CHECK (typeof(price_cents) = 'integer' AND price_cents BETWEEN 1 AND 10000000),
    featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
    tone TEXT NOT NULL CHECK (tone IN ('sage', 'clay', 'ink', 'sand', 'sky')),
    shape TEXT NOT NULL CHECK (shape IN ('lamp', 'mat', 'notebook', 'bottle', 'stand', 'bag', 'pen', 'tray')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE product_translations (
    product_id TEXT NOT NULL REFERENCES products(id),
    locale TEXT NOT NULL CHECK (locale IN ('en', 'ko')),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    PRIMARY KEY (product_id, locale)
  );
  CREATE TABLE inventory (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    stock_on_hand INTEGER NOT NULL CHECK (typeof(stock_on_hand) = 'integer' AND stock_on_hand BETWEEN 0 AND 1000000),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    updated_at TEXT NOT NULL
  );
  CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT NOT NULL
  );
  CREATE TABLE coupons (
    code TEXT PRIMARY KEY COLLATE NOCASE,
    percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
    min_subtotal_cents INTEGER NOT NULL CHECK (min_subtotal_cents >= 0),
    active INTEGER NOT NULL CHECK (active IN (0, 1))
  );
  CREATE TABLE orders (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_company TEXT NOT NULL,
    locale TEXT NOT NULL CHECK (locale IN ('en', 'ko')),
    status TEXT NOT NULL CHECK (status IN ('placed', 'packing', 'shipped')),
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    discount_cents INTEGER NOT NULL CHECK (discount_cents BETWEEN 0 AND subtotal_cents),
    shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents),
    coupon_code TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    packed_at TEXT,
    shipped_at TEXT
  );
  CREATE TABLE order_items (
    order_id TEXT NOT NULL REFERENCES orders(id),
    line_index INTEGER NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id),
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('desk', 'carry', 'paper')),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
    line_subtotal_cents INTEGER NOT NULL CHECK (line_subtotal_cents = unit_price_cents * quantity),
    discount_cents INTEGER NOT NULL CHECK (discount_cents BETWEEN 0 AND line_subtotal_cents),
    line_total_cents INTEGER NOT NULL CHECK (line_total_cents = line_subtotal_cents - discount_cents),
    PRIMARY KEY (order_id, line_index),
    UNIQUE (order_id, product_id)
  );
  CREATE TABLE inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    delta INTEGER NOT NULL CHECK (typeof(delta) = 'integer' AND delta != 0),
    reason TEXT NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX catalog_category_price ON products(category, price_cents, id);
  CREATE INDEX translations_name ON product_translations(locale, name, product_id);
  CREATE INDEX orders_customer_created ON orders(customer_id, created_at DESC, id);
  CREATE INDEX orders_status_created ON orders(status, created_at DESC, id);
  CREATE INDEX movement_product_created ON inventory_movements(product_id, created_at DESC, id);
  `,
];

export function migrate(database: Database): void {
  const current = database.pragma("user_version", { simple: true });
  if (typeof current !== "number" || current > migrations.length) {
    throw new Error("The database schema is newer than this application.");
  }
  database.transaction(() => {
    for (let index = current; index < migrations.length; index++) {
      database.exec(migrations[index]!);
      database.pragma(`user_version = ${index + 1}`);
    }
  }).immediate();
}
