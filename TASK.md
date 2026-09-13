# Reduce repeated catalog database work

## Business request

Repeated visits to the same catalog view should require substantially less database work.
Customers must still see the right localized products and current availability, and an
operator must not wait for a freshness window after saving a product edit.

## Quick start

Run `MARKETLANE_DB=.data/catalog-cache.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/catalog-cache.sqlite npm run db:reset -- --confirm`

## Observe current behavior

1. Open Shop at `http://127.0.0.1:5178`; compare English/Korean, filters, and sorts.
2. Repeat this documented catalog read and observe its catalog SQL work:

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=en&category=desk&sort=price-asc&page=1&pageSize=6&inStock=true'
```

3. In Inventory, inspect DSK-001's live stock, edit its product content, then make a
   valid stock adjustment. Read the catalog again; the current implementation reads
   metadata and inventory from SQLite on every request. Do not assume initial stock.

## Acceptance criteria

1. Catalog results retain locale and English fallback behavior, literal `%`/`_` search,
   category, all four sorts and their ID tiebreaks, page/pageSize, and inStock semantics.
   Different variants must not borrow another variant's items, counts, or contentLocale.
2. Catalog metadata may lag a committed change by at most 30 seconds. Document how
   freshness is measured and show behavior at the boundary, including a cold start.
   Repeated reads must not indefinitely extend the age of unchanged stored results.
3. After a successful `PATCH /api/products/:id`, every subsequent affected catalog
   variant and product detail read reflects the edit immediately, including sort and
   search membership changes. A failed edit must never publish uncommitted content.
4. A read begun after a checkout or stock adjustment commits reflects current stock.
   Cached positive availability must not survive a stock reduction. inStock membership,
   total/pageCount, and page contents must also respond to stock changes, not only badges.
5. Quotes and checkout retain authoritative current pricing and inventory validation.
   Availability displayed earlier never permits an oversell; failed checkout retains
   the existing all-or-nothing order and inventory behavior.
6. Provide reproducible query-count instructions for the exact URL above: report one
   cold read separately, then 20 identical warm reads within the freshness window.
   Against 20 uncached reads with the same data and request sequence, metadata reads fall by
   at least 80%. Identify counted SQL, include metadata work in mixed queries and refreshes,
   and report stock-only and total reads separately; elapsed time alone is insufficient.
7. Concurrent readers, expiration, and edits cannot mix variants or exceed the freshness
   allowance. If a read cannot meet that allowance, surface the existing structured error
   rather than presenting over-age data as current. Restarting does not break correctness.

## Boundaries and decisions

Choose what, if anything, to retain between reads and document the operational tradeoffs.
No Redis or external service is required. Preserve the current page API, pricing rules,
browser draft behavior, and physical-stock meaning; reservations are not part of this work.
Update the product/API documentation where the freshness contract becomes user-visible.

## Code starting points

- `server/catalog/repository.ts`: localized reads, counts, sorting, and product updates.
- `server/inventory/service.ts` and `server/orders/service.ts`: committed stock changes.
- `server/app.ts` and `shared/contracts.ts`: catalog HTTP inputs and response guarantees.
- `server/db/database.ts` and `test/*.test.ts`: database access and isolated query observation.
