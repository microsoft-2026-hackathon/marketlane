import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadPairingTask, preparePairingRuns } from "../scripts/prepare-pairing.js";
import { openDatabase } from "../server/db/database.js";
import { getProduct } from "../server/catalog/repository.js";
import { placeOrder } from "../server/orders/service.js";
import { counts, fixedClock, lampCart } from "./helpers.js";

const taskText = "# Cache the catalog\n\n## Business request\n\nReduce repeated work.\n\n## Acceptance criteria\n\nPRIVATE_EVALUATOR_SENTINEL\n";

test("pairing preparation separates criteria and history while cloning identical isolated databases", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-pairing-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = preparePairingRuns("catalog-cache", path.join(directory, "run"), taskText);
  assert.equal(readFileSync(path.join(output, "evaluator/TASK.full.md"), "utf8"), taskText);
  const baseline = readFileSync(path.join(output, "evaluator/baseline.sqlite"));
  for (const mode of ["beginner", "easy", "intermediate", "advanced"]) {
    const run = path.join(output, mode);
    const brief = readFileSync(path.join(run, "TASK.md"), "utf8");
    assert.match(brief, /Reduce repeated work/);
    assert.match(brief, /## 업무 요청/);
    assert.doesNotMatch(brief, /PRIVATE_EVALUATOR_SENTINEL|Acceptance criteria/);
    for (const excluded of [".git", "node_modules", "dist", "evaluator", "tasks", "scripts/prepare-pairing.ts", "test/pairing.test.ts"]) {
      assert.equal(existsSync(path.join(run, excluded)), false, excluded);
    }
    assert.equal(existsSync(path.join(run, "server/app.ts")), true);
    assert.equal(JSON.parse(readFileSync(path.join(run, "package.json"), "utf8")).scripts["pairing:prepare"], undefined);
    assert.deepEqual(readFileSync(path.join(run, ".data/marketlane.sqlite")), baseline);
  }
  const beginner = openDatabase(path.join(output, "beginner/.data/marketlane.sqlite"));
  const easy = openDatabase(path.join(output, "easy/.data/marketlane.sqlite"));
  try {
    const before = counts(easy);
    const stock = getProduct(easy, "product-arc-lamp").stockOnHand;
    placeOrder(beginner, lampCart, "en", fixedClock());
    assert.deepEqual(counts(easy), before);
    assert.equal(getProduct(easy, "product-arc-lamp").stockOnHand, stock);
  } finally {
    beginner.close();
    easy.close();
  }
  assert.throws(() => preparePairingRuns("catalog-cache", output, taskText), /EEXIST/);
  assert.deepEqual(readFileSync(path.join(output, "evaluator/baseline.sqlite")), baseline);
});

test("pairing preparation rejects unsupported tasks, missing inputs, and output inside the source", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-pairing-invalid-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "run");
  assert.throws(() => preparePairingRuns("unknown", output, taskText), /Choose a task/);
  assert.throws(() => preparePairingRuns("catalog-cache", output, "No task sections"), /Business request/);
  assert.throws(() => preparePairingRuns("inventory-import", output, taskText), /Missing task input/);
  assert.throws(() => preparePairingRuns("catalog-cache", fileURLToPath(new URL("../runs", import.meta.url)), taskText), /outside the source/);
  assert.equal(existsSync(output), false);
});

test("pairing preparation accepts Korean task headings without exposing acceptance criteria", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-pairing-ko-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const question = "> PAIR_OPENING_SENTINEL\n> 먼저 어디를 확인할까요?";
  const koreanTask = `# Catalog 반복 조회 개선\n\n## 업무 요청\n\n반복 조회 비용을 줄여 주세요.\n\n## Pair 시작 질문\n\n${question}\n\n## 수용 기준\n\nPRIVATE_CRITERIA\n`;
  const output = preparePairingRuns("catalog-cache", path.join(directory, "run"), koreanTask);
  const brief = readFileSync(path.join(output, "easy/TASK.md"), "utf8");
  assert.match(brief, /반복 조회 비용을 줄여 주세요/);
  assert.doesNotMatch(brief, /수용 기준|PRIVATE_CRITERIA/);
  assert.ok(brief.includes(question));
  const runGuide = readFileSync(path.join(output, "easy/RUN.md"), "utf8");
  assert.ok(runGuide.includes(question));
  assert.doesNotMatch(runGuide, /PRIVATE_CRITERIA/);
  assert.equal(readFileSync(path.join(output, "evaluator/TASK.full.md"), "utf8"), koreanTask);
});

test("pairing loads the main-workspace task definition before historical task branches", () => {
  const root = fileURLToPath(new URL("../tasks/", import.meta.url));
  const taskNames = ["catalog-cache", "catalog-pagination", "checkout-idempotency", "daily-sales",
    "inventory-import", "order-cancellation", "promotion-rules", "stock-reservations"];
  assert.deepEqual(readdirSync(root).sort(), taskNames);
  for (const task of taskNames) {
    const { taskText: loaded, assets } = loadPairingTask(task);
    assert.equal(loaded, readFileSync(path.join(root, task, "TASK.md"), "utf8"));
    assert.match(loaded, /^## 업무 요청$/m);
    assert.match(loaded, /^## Pair 시작 질문$/m);
    assert.match(loaded, /^## 수용 기준$/m);
    const expectedAssets = readdirSync(path.join(root, task)).filter(name => name !== "TASK.md").sort();
    assert.deepEqual(Object.keys(assets).sort(), expectedAssets);
    for (const name of expectedAssets) assert.deepEqual(assets[name], readFileSync(path.join(root, task, name)));
  }
  assert.throws(() => loadPairingTask("../catalog-cache"), /Choose a task/);
});

test("pairing preparation supplies business inputs but defers boundary examples to the facilitator", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "marketlane-pairing-inputs-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [task, filename, visible] of [
    ["inventory-import", "sample-adjustments.csv", true],
    ["daily-sales", "timestamp-cases.json", false],
  ] as const) {
    const content = Buffer.from("Sample input");
    const output = preparePairingRuns(task, path.join(directory, task), taskText, { [filename]: content });
    assert.deepEqual(readFileSync(path.join(output, "evaluator/inputs", filename)), content);
    for (const mode of ["beginner", "easy", "intermediate", "advanced"]) {
      assert.equal(existsSync(path.join(output, mode, filename)), visible);
      if (visible) assert.deepEqual(readFileSync(path.join(output, mode, filename)), content);
    }
  }
});