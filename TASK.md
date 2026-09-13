# Preview and apply inventory adjustments from CSV

## Business request

The operator receives batches of stock corrections and deliveries as CSV. Add a readable
preview followed by an explicit all-or-nothing apply, with enough identity and audit detail
to recover from a lost response without importing the same batch twice.

## Quick start

Run `MARKETLANE_DB=.data/inventory-import.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/inventory-import.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Inventory at `http://127.0.0.1:5178` and inspect DSK-001's actual quantity.

```sh
curl -X POST http://127.0.0.1:4310/api/inventory/adjustments \
  -H 'Content-Type: application/json' \
  -d '{"productId":"product-arc-lamp","delta":1,"reason":"Shelf recount","reference":"count-desk-01"}'
```

Read `GET /api/inventory` to see the adjustment and movement. The API accepts one product
ID at a time; reference is descriptive and does not prevent repeating this adjustment.
There is no CSV preview/apply flow. `sample-adjustments.csv` contains modest input examples,
not assumed stock balances; its repeated SKU has different row references.

## Acceptance criteria

1. Accept the columns sku,delta,reason,reference. Document encoding, headers, whitespace,
   blank-row behavior, and explicit byte/row/field limits. Handle UTF-8 with an optional BOM,
   LF/CRLF, quoted commas, escaped quotes, and quoted newlines; reject malformed quoting,
   missing/extra fields, and exceeded limits with useful locations, not silent truncation.
2. Identify row/field errors for unknown SKUs, zero/fractional/out-of-range deltas, and
   missing reasons or references. Imports require nonblank references; document normalization
   and reject duplicate references within a file. Repeated SKUs are allowed with documented
   processing semantics; combined deltas must not bypass the nonnegative-stock rule.
3. Preview is read-only, including no stock, movement, or import-state writes. It shows
   parsed adjustments, row errors, and each affected SKU's current/projected quantity.
   Any file error blocks apply; the UI never presents a partially valid file as applicable.
4. Apply revalidates the submitted rows and live stock rather than trusting preview totals.
   If checkout or a manual adjustment makes a previously valid batch unsafe, reject the
   entire batch with actionable details. Unknown SKUs or negative resulting stock also reject.
5. A successful apply records every stock change, reason, and reference in the movement
   ledger together with the accepted import. Any failure partway through leaves every SKU,
   movement, and accepted-import result unchanged; there is no partial-success mode.
6. Choose and document an import identity and retry contract that survive server restart
   and browser reload. Concurrent or repeated apply of an accepted identity cannot repeat
   movements; return its result or a clear already-applied outcome. Changed rows under the
   same identity conflict. Explain how a genuinely new delivery gets a distinct identity.
7. Inventory UI supports selecting a file, inspecting errors and totals, explicit apply,
   and recovery after an uncertain response using the same import identity. A stale preview
   failure prompts a fresh review, not an automatic second application of edited contents.
8. Existing `POST /api/inventory/adjustments` behavior remains unchanged, including optional,
   non-idempotent descriptive references. Import identities must not silently turn that
   endpoint's references into globally unique keys or alter checkout's stock ledger.

## Boundaries and decisions

This is a local CSV workflow, not a spreadsheet editor, supplier integration, or job platform.
No checkout-idempotency feature is assumed. Choose parsing and identity mechanisms without
changing the file's business meaning; document the API, limits, and durable schema upgrade.
Keep accepted order snapshots untouched.

## Code starting points

- `server/inventory/service.ts`: adjustment validation and movement creation.
- `server/db/database.ts` and `server/db/migrations.ts`: atomic persistence and import history.
- `server/app.ts` and `shared/contracts.ts`: preview/apply contracts and structured row errors.
- `client/` and `test/*.test.ts`: Inventory flow and existing isolated persistence coverage.
