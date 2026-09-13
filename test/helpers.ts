import type { TestContext } from "node:test";
import { createApp } from "../server/app.js";
import { openDatabase, type Database } from "../server/db/database.js";
import { seedDatabase } from "../server/db/seed.js";

export function fixedClock(initial = "2026-09-13T12:00:00.000Z") {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    set: (value: string) => { current = new Date(value); },
  };
}

export function databaseFixture(context: TestContext) {
  const database = openDatabase();
  const clock = fixedClock();
  seedDatabase(database, clock);
  context.after(() => database.close());
  return { database, clock };
}

export async function appFixture(context: TestContext) {
  const database = openDatabase();
  const clock = fixedClock();
  seedDatabase(database, clock);
  const app = await createApp({ database, clock });
  context.after(async () => {
    try { await app.close(); }
    finally { database.close(); }
  });
  return { database, clock, app };
}

export const lampCart = {
  customerId: "customer-ava",
  items: [{ productId: "product-arc-lamp", quantity: 1 }],
};

export function counts(database: Database) {
  return database.prepare<[], { orders: number; lines: number; movements: number }>(`
    SELECT (SELECT count(*) FROM orders) AS orders,
      (SELECT count(*) FROM order_items) AS lines,
      (SELECT count(*) FROM inventory_movements) AS movements
  `).get()!;
}
