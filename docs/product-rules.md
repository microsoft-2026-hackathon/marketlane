# Product rules

## Catalog and language

The catalog has stable product IDs and SKUs. English is the required content
language; Korean content is optional. A Korean request without a translation
falls back to English and identifies the actual `contentLocale`. Search uses
the displayed localized name, description, and SKU. `%` and `_` in a search
are literal characters, not SQL wildcards.

Catalog pagination is currently page/offset based. Sorts have a stable product
ID tiebreaker. Product updates affect subsequent reads and checkouts, not
already accepted orders. Inventory availability is current stock on hand.
No catalog response cache or stock reservation exists.

## Cart and pricing

A cart is local browser state. It contains product IDs and positive whole
quantities, never authoritative prices. At most 40 distinct products and 99
units of any one product are allowed. Duplicate product IDs in a request are
rejected rather than counted twice.

Quotes and checkout use the same pricing function. A quote is read-only and
does not guarantee future availability. All requested products must exist
and have sufficient stock.

Money is integer USD cents. Each line subtotal is unit price times quantity.
For the currently supported percentage coupon, each line discount is rounded
down to a whole cent; the order discount is the sum of line discounts.
`WELCOME10` requires a merchandise subtotal of at least 5,000 cents and reduces
each line by 10%. Coupon codes are trimmed and case-insensitive. Unknown,
inactive, or below-minimum coupons are rejected explicitly.

Shipping is 590 cents when discounted merchandise is below 10,000 cents,
otherwise zero. There is no tax calculation or currency conversion.
Server-calculated totals are the source of truth.

## Orders and fulfillment

Checkout validates the customer and cart, reloads prices and stock, writes the
order and its line snapshots, and decreases stock in one SQLite transaction.
A failed checkout leaves no order or partial inventory movement. Stock cannot
become negative. Checkout currently creates a new order for each successful
request; the browser must not automatically retry an ambiguous submission.

An order snapshots the customer, displayed product names, SKUs, categories,
prices, quantities, discounts, shipping, and total. Later catalog/customer
changes must not rewrite historical orders.

Fulfillment is `placed -> packing -> shipped`. Repeating the current status is
a no-op; skipping or reversing a transition is a conflict. Packing and shipping
do not change stock again. The corresponding transition timestamps are stored.
Cancellation, returns, actual payment capture, and refunds are not implemented.

## Inventory

An adjustment is a nonzero whole-number delta, a reason, and an optional
operator reference. Each adjustment and checkout stock decrement creates a
movement record in the same transaction. References are descriptive, not
currently idempotency keys. Negative adjustments cannot exceed available stock.

Low stock means `stockOnHand <= lowStockThreshold`, including zero.
The initial stock is represented in the movement ledger as opening balances.

## Operational context

One trusted local operator can switch customer context and fulfill orders.
There are no authentication, tenant-isolation, or role-based access promises.
The database belongs to that local installation.

Booked sales in the overview are the sum of accepted order totals, including
shipping. Category sales use order-line totals after discounts and exclude
shipping. These are operational totals, not payment settlement or accounting.
The current overview is all-time and is not a daily/timezone reporting API.
