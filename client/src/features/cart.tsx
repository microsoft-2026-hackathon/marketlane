import { useEffect, useState, type FormEvent } from "react";
import type { CartLine, CartQuote, Customer, InventoryState, Order } from "../../../shared/contracts.js";
import type { Resource } from "../hooks/use-resource.js";
import { errorMessage } from "../api.js";
import { itemCount, MAX_QUANTITY, quantityFromInput } from "../lib/cart-state.js";
import { formatMoney } from "../lib/money.js";
import { Icon } from "../components/icon.js";
import { ProductArt } from "../components/product-art.js";
import { EmptyState, ErrorState, LanguageBadge, Loading, Notice, Timestamp, TotalsBreakdown } from "../components/ui.js";

export interface CheckoutProblem {
  message: string;
  uncertain: boolean;
}

interface CartProps {
  customer: Customer | null;
  customers: Customer[];
  items: CartLine[];
  ready: boolean;
  loading: boolean;
  quote: Resource<CartQuote>;
  inventory: Resource<InventoryState>;
  couponCode: string;
  note: string;
  busy: boolean;
  checkingOut: boolean;
  problem: CheckoutProblem | null;
  confirmation: Order | null;
  onCustomerChange: (customerId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCouponChange: (code: string) => void;
  onNoteChange: (note: string) => void;
  onCheckout: () => void;
  onAcknowledgeUncertainty: () => void;
  onShop: () => void;
  onViewOrders: () => void;
  onViewOrder: (id: string) => void;
  onDetails: (id: string) => void;
}

export function Cart({
  customer, customers, items, ready, loading, quote, inventory, couponCode, note,
  busy, checkingOut, problem, confirmation, onCustomerChange, onQuantityChange, onRemove,
  onCouponChange, onNoteChange, onCheckout, onAcknowledgeUncertainty, onShop,
  onViewOrders, onViewOrder, onDetails,
}: CartProps) {
  const [couponInput, setCouponInput] = useState(couponCode);
  const [invalidInputs, setInvalidInputs] = useState<Map<string, string>>(() => new Map());
  const [couponError, setCouponError] = useState<string | null>(null);
  useEffect(() => { setCouponInput(couponCode); }, [couponCode]);
  const hasInvalidQuantities = items.some((item) => invalidInputs.has(item.productId));
  const currentQuote = hasInvalidQuantities ? null : quote.data;
  const products = new Map(inventory.data?.items.map((product) => [product.id, product]));
  const quotedLines = new Map(currentQuote?.items.map((line) => [line.productId, line]));

  function clearInput(productId: string) {
    setInvalidInputs((current) => {
      const next = new Map(current);
      next.delete(productId);
      return next;
    });
  }

  function updateQuantity(productId: string, value: string) {
    const quantity = quantityFromInput(value);
    if (quantity === null) {
      setInvalidInputs((current) => new Map(current).set(productId, value));
      return;
    }
    clearInput(productId);
    onQuantityChange(productId, quantity);
  }

  function applyCoupon(event: FormEvent) {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code, or remove the current code.");
      return;
    }
    setCouponError(null);
    setCouponInput(code);
    onCouponChange(code);
  }

  const canCheckout = ready && items.length > 0 && quote.data !== null && !quote.loading
    && !busy && !hasInvalidQuantities && !problem?.uncertain && customer !== null;

  return <div className="cart-view">
    <div className="page-heading">
      <div><p className="eyebrow">A FEW GOOD THINGS</p><h1>Your cart<span className="heading-count">{itemCount(items)}</span></h1>
        <p>A little more considered. A little more you.</p></div>
      <button className="button button-secondary" onClick={onShop} disabled={busy}>Keep browsing <Icon name="arrow" size={17} /></button>
    </div>

    <div className="cart-customer panel">
      <div><span className="eyebrow">SHOPPING FOR</span><p>{customer ? `${customer.company} / ${customer.email}` : "Choose the customer who will receive this order."}</p></div>
      <label className="field"><span className="sr-only">Cart customer</span>
        <select value={customer?.id ?? ""} onChange={(event) => onCustomerChange(event.target.value)} disabled={busy || customers.length === 0}>
          {!customer && <option value="">Select a customer</option>}
          {customers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
        </select>
      </label>
    </div>

    {confirmation && confirmation.customer.id === customer?.id && <section className="order-confirmation" aria-labelledby="confirmation-title" role="status">
      <span className="confirmation-icon"><Icon name="check" size={34} /></span>
      <p className="eyebrow">ORDER {confirmation.number}</p>
      <h2 id="confirmation-title">Good things are on the way.</h2>
      <p>Your order for <strong>{confirmation.customer.name}</strong> has been recorded and is ready for fulfillment.</p>
      <div className="confirmation-facts">
        <span>{itemCount(confirmation.items)} items</span><span>{formatMoney(confirmation.totals.totalCents)} USD</span><span><Timestamp value={confirmation.createdAt} withTime /></span>
      </div>
      <p className="small muted">No payment was collected. Follow the order from placed to shipped in Orders.</p>
      <div className="button-row">
        <button className="button button-primary" onClick={() => onViewOrder(confirmation.id)}>View order <Icon name="arrow" size={17} /></button>
        <button className="button button-secondary" onClick={onShop}>Back to the collection</button>
      </div>
    </section>}

    {loading && <Loading label="Restoring this customer's draft..." />}
    {!loading && !ready && <EmptyState icon="cart" title={customer ? "Your saved draft needs attention" : "Choose a customer to begin"}>
      {customer ? "Use the saved-cart notice above to recover this customer's cart. Other customers' drafts will not be changed." : "Each customer has a separate browser draft. Select an account to open its cart."}
    </EmptyState>}
    {ready && items.length === 0 && !confirmation && <EmptyState icon="cart" title="Room for something useful"
      action={<button className="button button-primary" onClick={onShop}>Explore the collection <Icon name="arrow" size={17} /></button>}>
      Your cart is empty. Find a few thoughtful essentials for your working day.
    </EmptyState>}

    {ready && items.length > 0 && <div className="cart-layout">
      <div className="cart-main">
        <Notice title="A draft, not a reservation">Items remain available to other orders until checkout. Current prices and stock are checked again when you place your order.</Notice>
        {inventory.error !== null && <ErrorState title="Product labels and stock could not be loaded" error={inventory.error} onRetry={inventory.reload} />}
        {inventory.loading && <div className="inline-loading" role="status"><span className="spinner" />Loading product details and current stock...</div>}
        <section className="cart-items panel" aria-label="Draft cart items">
          <div className="cart-items-heading"><h2>Your essentials</h2><span>{items.length} {items.length === 1 ? "product" : "products"}</span></div>
          {items.map((item) => {
            const product = products.get(item.productId);
            const line = quotedLines.get(item.productId);
            const name = product?.name ?? line?.name ?? item.productId;
            const invalid = invalidInputs.has(item.productId);
            const inputId = `quantity-${encodeURIComponent(item.productId)}`;
            return <article className="cart-item" key={item.productId}>
              <button className="cart-item-image" onClick={() => onDetails(item.productId)} disabled={busy}
                aria-label={`View ${name}`}>
                {product ? <ProductArt shape={product.shape} tone={product.tone} /> : <Icon name="inventory" size={30} />}
              </button>
              <div className="cart-item-content">
                <span className="product-category">{product?.sku ?? line?.sku ?? "PRODUCT DETAILS UNAVAILABLE"}</span>
                <h3><button className="product-name-button" onClick={() => onDetails(item.productId)} disabled={busy}
                  lang={product?.contentLocale}>{name}</button></h3>
                {product && <div className="cart-item-stock"><span>{product.stockOnHand} available &middot; Not reserved</span><LanguageBadge product={product} /></div>}
                {!product && inventory.data && <p className="field-error">This product is not in the current inventory. Remove it to continue.</p>}
                <div className="cart-quantity-row">
                  <div className={`quantity-control ${invalid ? "quantity-invalid" : ""}`}>
                    <button className="quantity-button" disabled={busy || item.quantity <= 1}
                      aria-label={`Decrease quantity of ${name}`} onClick={() => updateQuantity(item.productId, String(item.quantity - 1))}><Icon name="minus" size={14} /></button>
                    <label className="sr-only" htmlFor={inputId}>Quantity for {name}</label>
                    <input id={inputId} inputMode="numeric" value={invalidInputs.get(item.productId) ?? String(item.quantity)}
                      onChange={(event) => updateQuantity(item.productId, event.target.value)} disabled={busy}
                      aria-invalid={invalid} aria-describedby={invalid ? `${inputId}-error` : undefined} />
                    <button className="quantity-button" disabled={busy || item.quantity >= MAX_QUANTITY}
                      aria-label={`Increase quantity of ${name}`} onClick={() => updateQuantity(item.productId, String(item.quantity + 1))}><Icon name="plus" size={14} /></button>
                  </div>
                  <button className="text-button remove-button" disabled={busy} onClick={() => { clearInput(item.productId); onRemove(item.productId); }}
                    aria-label={`Remove ${name} from cart`}><Icon name="trash" size={15} />Remove</button>
                </div>
                {invalid && <p className="field-error" id={`${inputId}-error`}>Use a whole quantity from 1 to {MAX_QUANTITY}. This edit has not been applied.</p>}
              </div>
              <div className="cart-item-price">
                {line ? <><strong>{formatMoney(line.lineTotalCents)}</strong><span>{formatMoney(line.unitPriceCents)} each</span>
                  {line.discountCents > 0 && <small>Saved {formatMoney(line.discountCents)}</small>}</>
                  : <span className="muted">{quote.loading ? "Quoting..." : "Awaiting quote"}</span>}
              </div>
            </article>;
          })}
        </section>

        <section className="panel order-note-panel">
          <label className="field">Order note <span className="muted">(optional)</span>
            <textarea rows={3} maxLength={500} value={note} onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Anything the fulfillment team should know?" disabled={busy} />
            <span className="field-hint">Included in the order snapshot. Notes and coupons are kept only in this tab.</span>
          </label>
        </section>
      </div>

      <aside className="cart-summary" aria-labelledby="summary-title">
        <div className="panel quote-panel">
          <div className="quote-heading"><h2 id="summary-title">Order summary</h2><span className="currency-label">USD</span></div>
          <form className="coupon-form" onSubmit={applyCoupon}>
            <label className="field" htmlFor="coupon-code">Have a coupon?</label>
            <div className="coupon-input-row"><input id="coupon-code" value={couponInput}
              onChange={(event) => { setCouponInput(event.target.value); setCouponError(null); }}
              placeholder="Enter code" autoCapitalize="characters" autoComplete="off" maxLength={40} disabled={busy} />
              <button className="button button-secondary" disabled={busy || !couponInput.trim()}>Apply</button></div>
            {couponError && <p className="field-error" role="alert">{couponError}</p>}
          </form>
          {couponCode && <div className="coupon-chip"><Icon name="tag" size={16} /><strong>{couponCode}</strong>
            <span>{quote.data?.coupon ? "Applied" : quote.error !== null ? "Not applied" : "Checking..."}</span>
            <button className="icon-button" aria-label="Remove coupon" disabled={busy}
              onClick={() => { setCouponInput(""); setCouponError(null); onCouponChange(""); }}><Icon name="close" size={15} /></button>
          </div>}
          <p className="coupon-tip">WELCOME10 takes 10% off merchandise of $50 or more.</p>

          {quote.loading && !hasInvalidQuantities && <div className="quote-loading" role="status"><span className="spinner" />Calculating current prices...</div>}
          {quote.error !== null && <Notice tone="error" title="Your draft needs a fresh quote">{errorMessage(quote.error)} Your items have been kept so you can make changes.</Notice>}
          {currentQuote && <TotalsBreakdown totals={currentQuote.totals} couponCode={currentQuote.coupon?.code ?? null} />}
          {hasInvalidQuantities && <p className="unquoted-total">Correct the quantity fields to see the total for your draft.</p>}
          {!quote.loading && !quote.data && !hasInvalidQuantities && <p className="unquoted-total">Total unavailable until every item and the coupon can be quoted.</p>}
          {currentQuote && <p className="quote-timestamp"><Icon name="clock" size={14} />Quoted <Timestamp value={currentQuote.quotedAt} withTime /></p>}
          <button className="text-button refresh-quote" onClick={quote.reload} disabled={busy || quote.loading || hasInvalidQuantities}>
            <Icon name="refresh" size={15} />Refresh quote
          </button>

          {problem && <Notice tone={problem.uncertain ? "warning" : "error"}
            title={problem.uncertain ? "We could not confirm your order" : "Order was not placed"}
            actions={<>
              <button className="button button-small button-secondary" onClick={onViewOrders} disabled={busy}>Review this customer's orders</button>
              {problem.uncertain && <button className="text-button" onClick={onAcknowledgeUncertainty} disabled={busy}>
                I checked Orders; allow a new submission
              </button>}
            </>}>{problem.message}</Notice>}

          <button className="button button-primary checkout-button" disabled={!canCheckout} onClick={onCheckout}>
            {checkingOut ? <><span className="spinner" />Placing your order...</> : <><Icon name="cart" size={18} />Place order{currentQuote ? ` - ${formatMoney(currentQuote.totals.totalCents)}` : ""}</>}
          </button>
          {hasInvalidQuantities && <p className="field-error">Correct the quantity fields before placing an order.</p>}
          <p className="checkout-disclaimer">{checkingOut
            ? "Please keep this page open. Customer and cart changes are paused while your order is submitted."
            : "Checkout records an order; it does not charge a card. No tax or currency conversion is applied."}</p>
        </div>
        <p className="cart-persistence-note"><Icon name="info" size={16} />Only item IDs and quantities are saved to this customer's browser draft.</p>
      </aside>
    </div>}
  </div>;
}
