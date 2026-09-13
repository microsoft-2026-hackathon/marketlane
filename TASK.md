# Offer a five-minute cart hold

## Business request

Let a customer optionally hold a cart while deciding to purchase. Show when the hold ends,
protect those units from other buyers, and keep ordinary checkout without a hold available.
A hold protects quantities, not prices, and is separate from the browser's draft.

## Quick start

Run `MARKETLANE_DB=.data/stock-reservations.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/stock-reservations.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Shop and Inventory at `http://127.0.0.1:5178` and inspect actual available quantities.

1. Select customer-ava, add a stocked product such as product-arc-lamp, and request a quote.
2. Switch to customer-min and quote the same quantities. `POST /api/quotes` takes
   `{ "customerId": "customer-min", "items": [{ "productId": "product-arc-lamp", "quantity": 1 }] }`.
3. Compare `GET /api/catalog?inStock=true` and `GET /api/inventory` before and after quoting.
   A quote does not change stock or create a hold. Only a successful `POST /api/orders`
   currently claims units. Do not assume the seed has a particular remaining quantity.

## Acceptance criteria

1. Provide documented create, edit, release, and inspect operations for an optional hold,
   bound to a customer and exact product quantities. Invalid carts retain current cart
   limits. Document whether multiple active holds per customer are allowed and show which
   hold the browser draft uses; switching customer cannot use another customer's hold.
2. Creation and each explicit successful hold edit set expiration to five minutes from
   server time. Reads, quotes, UI refreshes, and failed edits never extend it. Return the
   expiration timestamp; the UI displays time remaining and a clear expired state.
3. Distinguish physical stockOnHand from sellable availability. Active holds reduce the
   latter without posting a physical stock movement. Catalog inStock filtering, quotes,
   ordinary checkout, and negative adjustments must respect units held for other carts.
4. Create, resize, release, and expiration are atomic with competing inventory operations.
   Failed increases preserve the prior quantities and expiration; reductions free units
   immediately. Repeated release or expiry cannot free the same units more than once.
5. Checkout with an active matching hold counts the owner's held units only once, uses
   current prices, and atomically consumes the hold with the order and physical decrement.
   Wrong-customer or mismatched-cart references reject explicitly. Reusing a consumed hold
   cannot create another order; general checkout idempotency is not required.
6. At server time equal to or later than expiresAt, hold checkout rejects even if stock
   happens to be free. Expired holds cannot be edited or silently resurrected by checkout;
   obtaining another hold requires explicit creation. Checkout racing expiry has one
   consistent outcome, never both a sale and availability for a competing sale.
7. Restarting the application retains active holds and their original expiration, while
   already elapsed holds no longer reduce availability. Use the existing injected Clock
   seam so just-before, exact-boundary, and just-after behavior is observable without waits.
8. The UI makes reserving optional, distinguishes held units from unheld availability,
   and surfaces failed edits or expired checkout without claiming success or losing the
   draft. Existing non-reserving checkout stays supported and cannot consume others' holds.

## Boundaries and decisions

No payment capture, price lock, automatic renewal, or authentication changes are requested.
Do not require checkout keys, new promotion rules, or cancellation support. Expiration
processing is an implementation choice; the timing and race guarantees are not.
Document hold lifecycle, availability fields, and durable schema upgrades.

## Code starting points

- `server/inventory/service.ts` and `server/catalog/repository.ts`: availability and adjustments.
- `server/orders/service.ts` and `server/pricing/pricing.ts`: checkout and quote stock decisions.
- `server/domain/clock.ts`, `server/db/migrations.ts`, and `server/app.ts`: Clock and persistence.
- `shared/contracts.ts` and `client/`: hold references, expiration, and optional cart controls.
