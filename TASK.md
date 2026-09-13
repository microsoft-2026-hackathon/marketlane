# Make an uncertain checkout safely retryable

## Business request

A customer who loses the checkout response needs a safe way to recover the accepted order,
not another purchase. Add an explicit, optional checkout idempotency key, scoped to customer,
and integrate that lifecycle with the browser's submitted draft.

## Quick start

Run `MARKETLANE_DB=.data/checkout-idempotency.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/checkout-idempotency.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Shop and Inventory at `http://127.0.0.1:5178`; inspect live stock before ordering.

1. With enough stock for two purchases, submit this same request manually twice:

```sh
curl -X POST 'http://127.0.0.1:4310/api/orders?locale=en' \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-ava","items":[{"productId":"product-arc-lamp","quantity":1}],"note":"Office purchase"}'
```

2. Compare `GET /api/orders?customerId=customer-ava` and `GET /api/inventory`.
   Each successful request creates its own order and stock movement.
3. Observe that the browser does not automatically retry an ambiguous submission.
   The current contract has no key; unknown JSON body properties are rejected.

## Acceptance criteria

1. Publish the optional key's HTTP location, permitted characters, length bounds, and
   whitespace/case normalization policy. Choose and enforce these rules explicitly in
   server validation and client use. Identical keys for different customers are independent.
2. Define equivalent requests, including item order, omitted/default fields, effective
   locale, note handling, and existing coupon trim/case rules. Reordered cart lines alone
   are equivalent. A changed effective product, quantity, coupon, locale, or note conflicts
   with a bound key and never creates another order; document the conflict response.
3. The same customer, key, and equivalent accepted request return the same order ID,
   number, and checkout snapshots, including after an application restart. Later price,
   stock, or customer changes must not turn recovery into a new quote or purchase.
   Document replay HTTP behavior without reverting later fulfillment changes.
4. Concurrent equivalent submissions converge on one accepted order, one set of checkout
   movements, and one inventory decrement per line. Concurrent conflicting payloads cannot
   both succeed. Any temporary in-progress response has a documented, safe retry behavior.
5. A response lost after commit remains recoverable with the original key and request,
   even after restarting against the same database. Repeating recovery does not reduce
   stock again, including when remaining stock would no longer cover a new purchase.
6. Validation errors, insufficient stock, and transaction failures leave no partial order
   or inventory changes and no false successful result. Document whether rejected attempts
   consume a key and how to retry them; failures must not leave an indefinitely stuck key.
7. The UI retains the submitted request's key through an uncertain response and reload,
   offers an explicit recovery action, and clears the draft only after confirmed acceptance.
   Customer switches and cart edits cannot attach a retry to a different purchase; a new
   intentional purchase gets a new key rather than replaying the previous accepted order.
8. A request without a key preserves today's behavior: each successful submission creates
   a new order. Do not silently infer keys from cart contents, notes, or submission timing.

## Boundaries and decisions

Use the existing local customer context; this adds no authentication or payment processor.
Reservations and inventory-import identities are not prerequisites. Preserve pricing,
order snapshots, and fulfillment. Document the new request/retry contract and upgrade
existing databases without discarding orders.

## Code starting points

- `shared/contracts.ts` and `server/app.ts`: checkout input and error contracts.
- `server/orders/service.ts` and `server/orders/repository.ts`: accepted checkout persistence.
- `server/db/migrations.ts`: durable key state and existing-database upgrades.
- `client/`: API client, checkout submission state, customer context, and browser drafts.
- `test/*.test.ts`: existing transaction, restart, and HTTP coverage locations.
