# Continue catalog browsing with an opaque cursor

## Business request

Customers browsing successive catalog batches should not see previously visited products
again merely because new products were inserted ahead of them. Add cursor traversal for
the existing sorts while retaining clear locale/filter behavior and an honest navigation UI.

## Quick start

Run `MARKETLANE_DB=.data/catalog-pagination.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/catalog-pagination.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Shop at `http://127.0.0.1:5178`; the initial catalog has 18 products across three categories.

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=en&sort=price-asc&page=1&pageSize=6'
curl 'http://127.0.0.1:4310/api/catalog?locale=en&sort=price-asc&page=2&pageSize=6'
```

Compare product IDs and CatalogPage's total, page, and pageCount. Traversal currently uses
page/offset. Inventory's product editor can create equal-price or equal-name cases on an
isolated database. Use a controlled local dataset for insertion observations; the documented
API exposes product updates, not product creation.

## Acceptance criteria

1. Offer documented first/next traversal using opaque cursors for featured, price-asc,
   price-desc, and localized name sorts. Preserve each sort's meaning and stable product-ID
   tiebreaks. Responses distinguish the end of results without requiring clients to decode
   cursor contents or manufacture another position.
2. Bind continuation to effective locale, search, category, inStock, and sort. Preserve
   English fallback and literal `%`/`_` search. Document normalization and whether pageSize
   may change mid-traversal; keep the existing maximum of 24. A changed bound query rejects.
3. With the unchanged 18-product catalog, unfiltered traversal at size 6 yields 18 unique
   IDs then the end. Cover size 5, empty filters, partial final batches, and at least three
   equal-price and equal-displayed-name products spanning a boundary. Include featured ties
   and English/Korean fallback cases; observe IDs, not merely names or list length.
4. Inserting records ahead of the cursor must not duplicate previously returned products
   whose sort fields are unchanged. Those new earlier records may wait until a fresh browse;
   document whether later insertions appear during continuation. This guarantee must hold
   when inserted and existing records share the primary sort value.
5. Document expected behavior when price, name/translation, featured, or filter membership
   changes between requests, including possible omissions/reappearances or explicit restart
   requirements. Do not promise immutable results unless actually provided. An anchor leaving
   inStock results must not produce an unexplained server error.
6. Malformed, oversized, truncated, unsupported-version, or stale-filter cursors receive
   clear structured client errors, never an unrelated 500 or silent first-page fallback.
   Document cursor lifetime and version invalidation if either is imposed.
7. Keep existing page API consumers working, or explicitly version the changed API and
   update every owned caller and its documentation. Do not reinterpret a page number as a
   cursor or leave old CatalogPage consumers expecting fields the server no longer returns.
8. Shop offers first/next navigation and a clear end state without invented page counts.
   Search, locale, category, sort, and availability changes reset traversal; document size
   changes too. Late responses from an earlier search cannot replace or append to the new
   results. A cursor error leaves a usable way to restart browsing.

## Boundaries and decisions

No catalog cache, reservations, external search service, or product-creation UI is required.
Immutable snapshots are optional, not a prerequisite. Choose and explain live-edit semantics
and compatibility policy; do not change prices, localization, or checkout authority.

## Code starting points

- `server/catalog/repository.ts`: filtering, sort expressions, tiebreaks, and current offsets.
- `shared/contracts.ts` and `server/app.ts`: CatalogQuery/CatalogPage and runtime validation.
- `client/`: Shop navigation, query state, and stale-response handling.
- `server/db/seed.ts` and `test/*.test.ts`: the 18-product dataset and tied-sort data cases.
