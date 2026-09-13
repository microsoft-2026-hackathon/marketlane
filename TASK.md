# Report accepted sales by local calendar date

## Business request

Give the operator a date-range view of accepted orders in a caller-selected IANA timezone,
including quiet days and links to the orders behind each amount. Separate merchandise from
shipping so category activity is not confused with delivery revenue.

## Quick start

Run `MARKETLANE_DB=.data/daily-sales.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/daily-sales.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Inspect the overview cards and open Orders at `http://127.0.0.1:5178`.

```sh
curl http://127.0.0.1:4310/api/overview
curl 'http://127.0.0.1:4310/api/orders?limit=100'
```

The overview is all-time: booked sales include shipping, while category sales exclude it.
Order responses expose createdAt and historical item/totals snapshots; no daily/timezone
report exists. Inspect actual timestamps rather than assuming seed dates. The order list
is capped at 100 and is not a complete reporting source for a larger local installation.
`timestamp-cases.json` supplies boundary inputs for controlled order times, not seed facts.

## Acceptance criteria

1. Publish a report API with real YYYY-MM-DD fromDate inclusive and toDate exclusive,
   plus a caller-selected IANA timeZone. Membership uses order createdAt interpreted in
   that timezone, not fulfillment time or the machine's timezone. Return the selected
   timezone and range so the UI can explain the result.
2. Return exactly one ordered bucket for every local calendar date in the half-open range,
   including zero-valued empty days. An order at the start instant is included; one at the
   end instant is excluded. Honor 23/25-hour DST days, both occurrences of a repeated hour,
   leap days, and month/year boundaries rather than treating every date as 24 elapsed hours.
3. All main statuses, placed, packing, and shipped, count as accepted orders. Moving an
   order through fulfillment never changes its reporting date or accepted sales amount.
   Do not assume a cancelled status exists or exclude packing/shipped orders.
4. Each bucket exposes order count, merchandise subtotal, discounts, net merchandise,
   shipping, and booked total in integer USD cents, plus category units/net merchandise.
   Net merchandise equals subtotal minus discounts; booked total equals net merchandise
   plus shipping. Category revenue excludes shipping and reconciles to net merchandise.
5. Prices, categories, quantities, and discounts come from historical order snapshots,
   not current catalog joins. Later product/customer edits cannot rewrite past report values
   or category attribution. Existing WELCOME10 and shipping snapshots remain unchanged.
6. Multi-line, multi-category orders contribute their order count and shipping exactly once.
   Joining lines must not multiply order-level totals. Range summaries equal the sum of
   daily buckets, and every bucket reconciles to its contributing orders without rounding drift.
7. Accept ranges of 1 through 366 local calendar dates. Reject empty/reversed/oversized
   ranges, impossible dates, and missing or unrecognized timezone identifiers with structured
   errors. Numeric UTC offsets are not a substitute for IANA identifiers; document accepted
   inputs, including UTC. Invalid dates must not normalize silently into another month.
8. The overview area offers date/timezone selection, daily rows, and drilldown to all contributing
   orders with their IDs, accepted times, and amounts. Drilldown uses the same date/zone
   membership and can reconcile to the bucket even beyond 100 orders; the current list cap
   must not silently truncate reporting. Empty dates remain visible and selectable.

## Boundaries and decisions

Keep the existing all-time `GET /api/overview` contract working. This is operational booked
sales, not financial settlement, payment capture, refunds, taxes, or currency conversion.
Cancellation, reservations, and new promotion rules are not prerequisites. Document report
and drilldown contracts, limits, and date semantics; no external analytics service is needed.

## Code starting points

- `server/orders/repository.ts`: accepted orders and historical line/total snapshots.
- `server/db/database.ts` and `server/app.ts`: database access, Clock seam, and reporting routes.
- `shared/contracts.ts` and `client/`: typed report data, Overview controls, and order links.
- `test/*.test.ts`: isolated order-time, money, and HTTP boundary coverage locations.
