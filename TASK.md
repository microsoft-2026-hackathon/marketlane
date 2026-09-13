# Cancel an order before shipment

## Business request

The operator needs to withdraw a mistaken order before dispatch, return its units to stock,
and retain a clear historical record. Add cancellation for placed and packing orders;
shipped orders remain outside this workflow.

## Quick start

Run `MARKETLANE_DB=.data/order-cancellation.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/order-cancellation.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Shop, Orders, and Inventory at `http://127.0.0.1:5178`.
The overview cards above these views show the current operational totals.

1. Inspect live stock, select customer-ava, and place a small supported cart.
   Record the new order ID and its stock movements; do not assume seed order statuses.
2. Read `GET /api/orders/:id`, replacing :id with that ID. Use the Orders action or
   `PATCH /api/orders/:id/status` with `{ "status": "packing" }` to advance it.
3. Compare `GET /api/inventory` and `GET /api/overview`: packing does not move stock again,
   and the accepted total is booked sales. The current status input permits only packing
   or shipped; neither a cancellation endpoint nor a cancellation UI action exists yet.

## Acceptance criteria

1. Add an explicit terminal cancelled status, durable schema support, and a documented
   cancellation API. Placed and packing orders may cancel; shipped orders reject with a
   structured conflict. Cancelled orders cannot subsequently pack or ship. Update status
   validation, filters, shared types, and existing-database upgrades deliberately.
2. Require a nonblank cancellation reason, with documented trimming and length bounds,
   and record a server-clock UTC cancellation time. Preserve createdAt, packedAt when set,
   and all original customer, item, category, price, coupon, shipping, total, and note snapshots.
   Cancellation must not rewrite the accepted order into a zero-value purchase.
3. Cancellation restores the historical quantities to current physical stock exactly once,
   with attributable movement records referencing the order. Status, reason/time, restock,
   and ledger changes commit together. Any transaction failure leaves all of them unchanged.
4. Repeating the same cancellation returns the existing cancelled order without another
   restock or changed cancellation metadata, including after restart. A different reason
   on an already cancelled order conflicts rather than silently replacing the audit record.
5. Simultaneous cancellation requests cannot duplicate movements. For a packing order,
   simultaneous ship and cancel produce exactly one terminal outcome; the losing request
   conflicts. A successful shipment never coexists with cancellation restock.
6. Overview bookedSalesCents excludes cancelled orders and otherwise still includes
   shipping. Category units/revenue exclude cancelled lines and remain net of discounts,
   excluding shipping. openOrderCount includes only placed/packing; recent orders may still
   show cancelled orders clearly. Document these operational, non-settlement semantics.
7. Orders UI offers cancellation only where applicable, collects the reason, and makes the
   consequence clear before submission. It displays reason/time afterwards, preserves order
   details, refreshes inventory/overview, and surfaces a ship/cancel conflict rather than
   displaying an optimistic cancellation as completed.
8. Existing placement and placed-to-packing-to-shipped behavior remain intact, including
   no additional stock change during fulfillment. Old orders stay readable after migration,
   and status-filtered lists can explicitly retrieve cancelled orders.

## Boundaries and decisions

No refunds, returns, payment provider, post-shipment reversal, or new authentication model.
Do not depend on reservations, new promotion rules, or checkout idempotency. Cancellation
must work with the main baseline's existing order snapshots and stock ledger.
Choose a clear cancellation endpoint shape and update product, architecture, and API docs.

## Code starting points

- `server/orders/service.ts` and `server/orders/repository.ts`: transitions and order data.
- `server/inventory/service.ts` and `server/db/migrations.ts`: restock audit and schema changes.
- `server/app.ts` and `shared/contracts.ts`: status/API validation and overview contracts.
- `client/` and `test/*.test.ts`: Orders controls, Overview, and transactional behavior.
