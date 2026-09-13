import Sqlite from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrate } from "./migrations.js";

export type Database = Sqlite.Database;

export function databasePath(): string {
  return path.resolve(process.env.MARKETLANE_DB ?? ".data/marketlane.sqlite");
}

export function openDatabase(filename = ":memory:"): Database {
  if (filename !== ":memory:") mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const database = new Sqlite(filename);
  try {
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 3000");
    if (filename !== ":memory:") database.pragma("journal_mode = WAL");
    migrate(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
