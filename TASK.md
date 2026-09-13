# Support category and fixed-amount promotions

## Business request

Add two useful offers while preserving every existing WELCOME10 result:
DESK15 takes 15% off desk merchandise when its eligible subtotal reaches 5,000 cents;
TAKE1200 takes up to 1,200 cents off merchandise across categories, with no minimum.
Make discount allocation understandable in quotes and historical orders.

## Quick start

Run `MARKETLANE_DB=.data/promotion-rules.sqlite npm run dev` from the repository root.
Do not use main's default database or share this persisted file with another branch.
Stop the server before switching branches or resetting. Optional reset:
`MARKETLANE_DB=.data/promotion-rules.sqlite npm run db:reset -- --confirm`

## Observe current behavior

Open Shop at `http://127.0.0.1:5178` and build a cart from products with sufficient live stock.

1. Use the coupon input and `POST /api/quotes?locale=en` with customerId, items, and
   couponCode. WELCOME10 requires at least 5,000 cents of merchandise before discounts.
2. Inspect the quote's item discountCents and totals: each current percentage line discount
   is rounded down, and shipping is 590 cents below 10,000 discounted merchandise cents.
3. Try DESK15 and TAKE1200 on that stocked cart; they are currently unknown codes.
   A successful `POST /api/orders` stores line and total snapshots, not a live pricing view.
   Use current prices and quantities rather than assuming the seed lamp meets a threshold.

## Acceptance criteria

1. WELCOME10 alone remains exactly compatible: trim/case normalization, 5,000-cent
   pre-discount merchandise minimum, per-line downward rounding at 10%, summed discounts,
   and shipping outcomes. Preserve explicit unknown, inactive, and below-minimum errors.
2. DESK15 applies only to desk lines and requires at least 5,000 cents of pre-discount desk
   merchandise. Carry/paper lines neither qualify it nor receive its discount. Document its
   whole-cent percentage rounding, including multiple eligible lines and no eligible lines.
3. TAKE1200 alone discounts min(1,200 cents, merchandise subtotal); it never discounts
   shipping. Allocate the amount proportionally to eligible line values, with whole-cent
   shares within one cent of their proportional entitlement. Document a deterministic tie
   rule that does not depend on request line order; zero-value lines receive no discount.
4. Choose and document stacking explicitly: either reject multiple codes, or define allowed
   combinations, application order, threshold bases, and overlapping-line behavior.
   Keep existing single couponCode requests valid. Never silently discard an extra code
   or allow stacking accidentally through inconsistent quote and checkout inputs.
5. Every line and total remains nonnegative and in integer USD cents. Line discounts sum
   exactly to the order discount, and line totals reconcile to discounted merchandise.
   Cover minimum supported prices, fixed-offer carts at 1,199/1,200/1,201 cents, tied
   allocations, mixed categories, and quantities near existing cart limits.
6. Cover qualification at 4,999/5,000 cents and discounted merchandise at 9,999/10,000.
   Shipping stays 590/0 cents at the latter boundary, including when a promotion changes
   eligibility. A fully discounted nonempty cart still follows the existing shipping rule.
7. Quotes and checkout use the same promotion behavior, while checkout still reads live
   prices and stock. Changing line order cannot change per-product allocation or totals.
   Unsupported or ineligible combinations produce the existing structured error envelope.
8. UI shows the applied offer(s), eligibility failures, and reconciled totals. New orders
   retain enough snapshot information to explain their discounts; changing product data
   or promotion definitions never reprices accepted orders, including older WELCOME10 orders.

## Boundaries and decisions

USD only, with no taxes, currency conversion, payment processor, or promotion scheduling.
A promotion-management console is not required. This work uses existing ordinary checkout,
not reservations or cancellation. Document the chosen stacking and rounding policies in
the pricing rules and API contracts; allocation implementation remains a design decision.

## Code starting points

- `server/pricing/pricing.ts`: existing percentage, threshold, and shipping behavior.
- `shared/contracts.ts` and `server/app.ts`: coupon input and quote response representation.
- `server/orders/service.ts` and `server/orders/repository.ts`: accepted order snapshots.
- `server/db/migrations.ts`: compatibility for persisted promotion information.
- `client/` and `test/*.test.ts`: coupon controls, line totals, and integer-price coverage.
