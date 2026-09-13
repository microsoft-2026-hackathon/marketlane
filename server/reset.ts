import { databasePath, openDatabase } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";

if (process.argv.slice(2).join(" ") !== "--confirm") {
  console.error("Stop the server, then run npm run db:reset -- --confirm to replace the configured local data.");
  process.exitCode = 1;
} else {
  const filename = databasePath();
  const database = openDatabase(filename);
  try {
    database.transaction(() => {
      database.exec(`
        DELETE FROM inventory_movements;
        DELETE FROM order_items;
        DELETE FROM orders;
        DELETE FROM coupons;
        DELETE FROM inventory;
        DELETE FROM product_translations;
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM app_metadata;
        DELETE FROM sqlite_sequence WHERE name = 'orders';
      `);
      seedDatabase(database);
    }).immediate();
    console.log(`Restored the initial Marketlane data in ${filename}`);
  } finally {
    database.close();
  }
}
