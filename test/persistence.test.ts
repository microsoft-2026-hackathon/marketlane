import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { openDatabase } from "../server/db/database.js";
import { seedDatabase } from "../server/db/seed.js";
import { getProduct } from "../server/catalog/repository.js";
import { getOrder } from "../server/orders/repository.js";
import { placeOrder } from "../server/orders/service.js";
import { counts, fixedClock, lampCart } from "./helpers.js";

test("a file-backed database reopens without losing snapshots or repeating the seed", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-persistence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "store.sqlite");
  const clock = fixedClock();
  const database = openDatabase(filename);
  seedDatabase(database, clock);
  const order = placeOrder(database, lampCart, "ko", clock);
  const stock = getProduct(database, "product-arc-lamp").stockOnHand;
  const before = counts(database);
  database.close();
  const reopened = openDatabase(filename);
  try {
    seedDatabase(reopened, clock);
    assert.deepEqual(getOrder(reopened, order.id), order);
    assert.equal(getProduct(reopened, "product-arc-lamp").stockOnHand, stock);
    assert.deepEqual(counts(reopened), before);
    assert.equal(reopened.pragma("user_version", { simple: true }), 1);
    assert.equal(reopened.pragma("foreign_keys", { simple: true }), 1);
  } finally {
    reopened.close();
  }
});

test("the application refuses to open a newer schema rather than resetting it", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-schema-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "store.sqlite");
  const database = openDatabase(filename);
  database.pragma("user_version = 99");
  database.close();
  assert.throws(() => openDatabase(filename), /newer than this application/);
});

test("reset requires confirmation and affects only the explicitly configured database", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-reset-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "store.sqlite");
  const database = openDatabase(filename);
  const clock = fixedClock();
  seedDatabase(database, clock);
  placeOrder(database, lampCart, "en", clock);
  const before = counts(database);
  database.close();
  const options = {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, MARKETLANE_DB: filename },
    encoding: "utf8" as const,
  };
  const denied = spawnSync(process.execPath, ["--import", "tsx", "server/reset.ts"], options);
  assert.equal(denied.status, 1, denied.stderr);
  const unchanged = openDatabase(filename);
  assert.deepEqual(counts(unchanged), before);
  unchanged.close();
  const accepted = spawnSync(process.execPath, ["--import", "tsx", "server/reset.ts", "--confirm"], options);
  assert.equal(accepted.status, 0, accepted.stderr);
  const restored = openDatabase(filename);
  try {
    assert.equal(counts(restored).orders, 5);
    assert.equal(getProduct(restored, "product-arc-lamp").stockOnHand, 17);
  } finally {
    restored.close();
  }
});

test("response-loss faults require a recognized value and development mode before opening a database", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-fault-config-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "store.sqlite");
  for (const [fault, args, message] of [
    ["drop-order-response-once", [], /available only with --dev/],
    ["drop-order-response-typo", ["--dev"], /must be unset or drop-order-response-once/],
  ] as const) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "server/main.ts", ...args], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, MARKETLANE_DB: filename, MARKETLANE_FAULT: fault },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    assert.equal(existsSync(filename), false);
  }
});
