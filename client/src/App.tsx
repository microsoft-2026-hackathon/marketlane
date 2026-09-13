import { useEffect, useRef, useState } from "react";
import type { CheckoutRequest, InventoryAdjustment, Locale, Order, Product, ProductUpdate, QuoteRequest } from "../../shared/contracts.js";
import { api, ApiError, errorMessage } from "./api.js";
import { useDraftCarts } from "./hooks/use-draft-carts.js";
import { useResource } from "./hooks/use-resource.js";
import { addCartLine, itemCount, quoteDraftKey, removeCartLine, sameCartLines, setLineQuantity } from "./lib/cart-state.js";
import { formatMoney } from "./lib/money.js";
import { BrandMark, Icon, type IconName } from "./components/icon.js";
import { OverviewStrip } from "./components/overview.js";
import { ErrorState, Notice } from "./components/ui.js";
import { Shop } from "./features/shop.js";
import { Cart, type CheckoutProblem } from "./features/cart.js";
import { OrderDetails, Orders } from "./features/orders.js";
import { Inventory, InventoryAdjustmentDialog } from "./features/inventory.js";
import { ProductDetails, ProductEditor } from "./features/products.js";

type View = "shop" | "cart" | "orders" | "inventory";
type Mutation = "checkout" | "product" | "inventory" | "status";
type Dialog = { kind: "details" | "edit" | "adjust" | "order"; id: string };
type Flash = { tone: "success" | "info" | "error"; message: string; cartLink: boolean };
interface DraftMetadata { couponCode: string; note: string }

const emptyMetadata: DraftMetadata = { couponCode: "", note: "" };
const navigation: { view: View; label: string; icon: IconName }[] = [
  { view: "shop", label: "Shop", icon: "shop" },
  { view: "cart", label: "Your cart", icon: "cart" },
  { view: "orders", label: "Orders", icon: "orders" },
  { view: "inventory", label: "Inventory", icon: "inventory" },
];

export function App() {
  const [view, setView] = useState<View>("shop");
  const [locale, setLocale] = useState<Locale>("en");
  const [customerId, setCustomerId] = useState("");
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [mutation, setMutation] = useState<Mutation | null>(null);
  const mutationOwner = useRef<Mutation | null>(null);
  const [metadata, setMetadata] = useState<Record<string, DraftMetadata>>({});
  const [checkoutProblems, setCheckoutProblems] = useState<Record<string, CheckoutProblem>>({});
  const [confirmation, setConfirmation] = useState<Order | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [ordersCustomerId, setOrdersCustomerId] = useState("");
  const pageHeading = useRef<HTMLElement>(null);

  const config = useResource("config", api.config);
  const customerResource = useResource("customers", api.customers);
  const customers = customerResource.data?.items ?? [];
  const customer = customers.find((entry) => entry.id === customerId) ?? null;
  const inventory = useResource(`inventory:${locale}:${revision}`, (signal) => api.inventory(locale, signal));
  const overview = useResource(`overview:${revision}`, api.overview);
  const draft = useDraftCarts(customerId);
  const activeMetadata = metadata[customerId] ?? emptyMetadata;
  const busy = mutation !== null;
  const canAdd = customer !== null && draft.ready && !busy;
  const count = itemCount(draft.items);

  useEffect(() => {
    if (customerResource.data && !customerResource.data.items.some((entry) => entry.id === customerId)) {
      setCustomerId(customerResource.data.items[0]?.id ?? "");
    }
  }, [customerResource.data, customerId]);

  useEffect(() => {
    document.title = `${navigation.find((entry) => entry.view === view)?.label ?? "Shop"} - Marketlane`;
  }, [view]);

  const quoteRequest: QuoteRequest = {
    customerId,
    items: draft.items,
    ...(activeMetadata.couponCode ? { couponCode: activeMetadata.couponCode } : {}),
  };
  const quoteKey = customer && draft.ready && draft.items.length > 0
    ? `${quoteDraftKey(customerId, locale, draft.items, activeMetadata.couponCode)}:${revision}` : null;
  const quote = useResource(quoteKey, (signal) => api.quote(quoteRequest, locale, signal));

  function navigate(next: View) {
    if (mutationOwner.current) return;
    setView(next);
    setDialog(null);
    window.scrollTo({ top: 0, behavior: "instant" });
    pageHeading.current?.focus({ preventScroll: true });
  }

  function selectCustomer(id: string) {
    if (mutationOwner.current) return;
    if (!customers.some((entry) => entry.id === id)) {
      setFlash({ tone: "error", message: "That customer is no longer available. Reload the customer list.", cartLink: false });
      return;
    }
    setCustomerId(id);
    setFlash(null);
  }

  function clearDefiniteProblem(id: string) {
    setCheckoutProblems((current) => {
      if (!current[id] || current[id]?.uncertain) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function changeDraft(change: () => void): string | null {
    if (mutationOwner.current) return "Please wait for the current operation to finish before changing the cart.";
    try {
      change();
      clearDefiniteProblem(customerId);
      if (confirmation?.customer.id === customerId) setConfirmation(null);
      return null;
    } catch (error) {
      const message = errorMessage(error);
      setFlash({ tone: "error", message, cartLink: true });
      return message;
    }
  }

  function add(product: Product, quantity = 1): string | null {
    const failure = changeDraft(() => {
      if (!customer || !draft.ready) throw new Error("Select a customer and resolve any saved-cart notice before adding items.");
      draft.replace(customerId, addCartLine(draft.items, product.id, quantity));
    });
    if (!failure) {
      setFlash({ tone: "success", message: `${quantity === 1 ? product.name : `${quantity} x ${product.name}`} added to ${customer?.name}'s draft.`, cartLink: true });
      setDialog(null);
    }
    return failure;
  }

  function changeMetadata(update: Partial<DraftMetadata>) {
    if (mutationOwner.current) return;
    setMetadata((current) => ({ ...current, [customerId]: { ...(current[customerId] ?? emptyMetadata), ...update } }));
    clearDefiniteProblem(customerId);
  }

  async function performMutation<T>(kind: Exclude<Mutation, "checkout">, action: () => Promise<T>): Promise<T> {
    if (mutationOwner.current) throw new Error("Another operation is still running. Please wait for it to finish.");
    mutationOwner.current = kind;
    setMutation(kind);
    try {
      const result = await action();
      setRevision((value) => value + 1);
      return result;
    } finally {
      mutationOwner.current = null;
      setMutation(null);
    }
  }

  async function saveProduct(id: string, update: ProductUpdate) {
    const result = await performMutation("product", () => api.updateProduct(id, update));
    setDialog(null);
    setFlash({ tone: "success", message: `${result.product.sku} updated. New quotes and orders will use these details.`, cartLink: false });
  }

  async function adjustInventory(adjustment: InventoryAdjustment) {
    const result = await performMutation("inventory", () => api.adjustInventory(adjustment));
    setDialog(null);
    setFlash({ tone: "success", message: `${result.product.sku}: ${result.movement.delta > 0 ? "+" : ""}${result.movement.delta} units recorded in the movement ledger.`, cartLink: false });
  }

  async function advanceOrder(id: string, status: "packing" | "shipped") {
    const result = await performMutation("status", () => api.updateOrderStatus(id, status));
    setFlash({ tone: "success", message: `${result.order.number} is now ${result.order.status}.`, cartLink: false });
  }

  async function checkout() {
    if (mutationOwner.current) return;
    if (!customer || !draft.ready || !quote.data || quote.loading || quoteKey === null || checkoutProblems[customerId]?.uncertain
      || quote.data.locale !== locale || !sameCartLines(quote.data.items, draft.items)) {
      setFlash({ tone: "error", message: "A valid quote for this customer's current draft is required. Resolve the cart notices before placing an order.", cartLink: true });
      return;
    }
    const ownerId = customer.id;
    const submittedLocale = locale;
    const submitted: CheckoutRequest = {
      customerId: ownerId,
      items: draft.items.map(({ productId, quantity }) => ({ productId, quantity })),
      ...(activeMetadata.couponCode ? { couponCode: activeMetadata.couponCode } : {}),
      ...(activeMetadata.note.trim() ? { note: activeMetadata.note.trim() } : {}),
    };
    mutationOwner.current = "checkout";
    setMutation("checkout");
    setCheckoutProblems((current) => {
      const next = { ...current };
      delete next[ownerId];
      return next;
    });
    setFlash(null);
    try {
      // Do not abort or retry checkout: losing the response does not prove the order failed.
      const { order } = await api.checkout(submitted, submittedLocale);
      if (!order || !order.id || !order.number || order.customer?.id !== ownerId || order.locale !== submittedLocale || order.currency !== "USD"
        || !Array.isArray(order.items) || order.items.length !== submitted.items.length
        || !sameCartLines(order.items, submitted.items)) {
        throw new Error("The order acknowledgement did not match the submitted draft.");
      }
      draft.replace(ownerId, []);
      setMetadata((current) => ({ ...current, [ownerId]: { couponCode: "", note: "" } }));
      setConfirmation(order);
      setDialog(null);
      setView("cart");
    } catch (error) {
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500;
      setCheckoutProblems((current) => ({
        ...current,
        [ownerId]: {
          uncertain: !rejected,
          message: rejected
            ? `${errorMessage(error)} Your draft has been preserved.`
            : `The server may already have accepted this order. Your draft has been preserved, and no retry was sent. Check this customer's Orders before submitting again. ${errorMessage(error)}`,
        },
      }));
    } finally {
      setRevision((value) => value + 1);
      mutationOwner.current = null;
      setMutation(null);
    }
  }

  function reviewCustomerOrders() {
    setOrdersCustomerId(customerId);
    navigate("orders");
  }

  function acknowledgeUncertainty() {
    if (mutationOwner.current) return;
    setCheckoutProblems((current) => {
      const next = { ...current };
      delete next[customerId];
      return next;
    });
    quote.reload();
    setFlash({ tone: "info", message: "A new submission is now allowed after the quote refreshes. Only place another order if the earlier submission was not accepted; each successful request creates a separate order.", cartLink: false });
  }

  function openOrder(id: string) {
    if (mutationOwner.current) return;
    setView("orders");
    setDialog({ kind: "order", id });
  }

  const closeDialog = () => { if (!mutationOwner.current) setDialog(null); };
  const activeConfirmation = confirmation?.customer.id === customerId ? confirmation : null;
  const customerInitials = customer?.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("shop")} disabled={busy} aria-label="Marketlane home"><BrandMark /><span>Marketlane<small>WORKSPACE GOODS</small></span></button>
      <div className="sidebar-navigation">
        <p className="nav-section-label">YOUR WORKING DAY</p>
        <nav aria-label="Main navigation">
          {navigation.map((entry) => <button key={entry.view} className={`nav-item ${view === entry.view ? "active" : ""}`}
            aria-current={view === entry.view ? "page" : undefined} disabled={busy} onClick={() => navigate(entry.view)}>
            <Icon name={entry.icon} /><span>{entry.label}</span>
            {entry.view === "cart" && count > 0 && <span className="nav-count">{count}</span>}
            {entry.view === "orders" && overview.data && overview.data.openOrderCount > 0 && <span className="nav-order-count">{overview.data.openOrderCount}</span>}
          </button>)}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-message"><span className="sidebar-leaf"><Icon name="leaf" size={25} /></span><p>Less clutter.<br /><strong>More possibility.</strong></p><span>Thoughtful goods for<br />the working day.</span></div>
        <div className="workspace-identity"><span className="workspace-dot" /><div><strong>Local workspace</strong><span>Shop &amp; operations</span></div></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{navigation.find((entry) => entry.view === view)?.label}</strong></div>
        <div className="topbar-controls">
          <label className="header-select"><Icon name="globe" size={17} /><span className="sr-only">Catalog language</span>
            <select value={locale} disabled={busy} aria-label="Catalog language" title="Changes catalog content only. Prices remain USD."
              onChange={(event) => { if (!mutationOwner.current) setLocale(event.target.value as Locale); }}>
              <option value="en">English</option><option value="ko">Korean</option>
            </select>
          </label>
          <div className="customer-control"><span className="customer-avatar" aria-hidden="true">{customerInitials}</span>
            <label className="header-customer-select"><span>Shopping for</span>
              <select value={customer?.id ?? ""} disabled={busy || customers.length === 0} onChange={(event) => selectCustomer(event.target.value)} aria-label="Shopping customer">
                {!customer && <option value="">{customerResource.loading ? "Loading customers..." : "Select a customer"}</option>}
                {customers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
              </select>
            </label>
          </div>
          <button className="header-cart" onClick={() => navigate("cart")} disabled={busy} aria-label={`Open cart, ${count} items`}>
            <Icon name="cart" size={20} /><span className="header-cart-count">{count}</span>
            {count > 0 && <span className="header-cart-total">{quote.data ? formatMoney(quote.data.totals.totalCents) : quote.loading ? "Quoting..." : "Needs quote"}</span>}
          </button>
        </div>
      </header>

      <main className="main-content" id="main-content" ref={pageHeading} tabIndex={-1}>
        {config.error !== null && <ErrorState title="Store settings could not be loaded" error={config.error} onRetry={config.reload} />}
        {customerResource.error !== null && <ErrorState title="Customers could not be loaded" error={customerResource.error} onRetry={customerResource.reload} />}
        {customerResource.data?.items.length === 0 && <Notice tone="warning" title="No customers are available">Browsing is available, but a customer is required to prepare a cart or place an order.</Notice>}
        {draft.notice && <Notice tone={draft.notice.kind === "temporary" ? "info" : "warning"}
          title={draft.notice.kind === "corrupt" ? "Saved cart needs recovery" : draft.notice.kind === "temporary" ? "Temporary cart" : "Browser storage needs attention"}
          actions={<>
            {draft.notice.kind === "corrupt" && <button className="button button-small button-secondary" disabled={busy} onClick={draft.reset}>Reset this customer's saved cart</button>}
            {draft.notice.kind !== "temporary" && <button className="button button-small button-secondary" disabled={busy} onClick={draft.retryStorage}>
              {draft.notice.kind === "unsaved" ? "Retry saving" : "Try loading again"}
            </button>}
            {draft.notice.kind === "unavailable" && <button className="text-button" disabled={busy} onClick={draft.useTemporary}>Use a temporary cart</button>}
          </>}>{draft.notice.message}</Notice>}
        {flash && <div className="flash-container"><Notice tone={flash.tone} actions={flash.cartLink && view !== "cart"
          ? <button className="text-button" disabled={busy} onClick={() => navigate("cart")}>View cart <Icon name="arrow" size={15} /></button>
          : undefined}>{flash.message}</Notice>
          <button className="icon-button flash-dismiss" onClick={() => setFlash(null)} aria-label="Dismiss notification"><Icon name="close" size={17} /></button>
        </div>}
        {view !== "cart" && quote.error !== null && draft.items.length > 0 && <Notice tone="warning" title="Your cart needs attention"
          actions={<button className="text-button" disabled={busy} onClick={() => navigate("cart")}>Open cart to make changes <Icon name="arrow" size={15} /></button>}>
          {errorMessage(quote.error)} Your draft has been kept.
        </Notice>}

        <OverviewStrip resource={overview} />
        {view === "shop" && <Shop locale={locale} revision={revision} config={config.data} canAdd={canAdd} busy={busy}
          onAdd={add} onDetails={(id) => setDialog({ kind: "details", id })} onEdit={(id) => setDialog({ kind: "edit", id })} />}
        {view === "cart" && <Cart key={customerId} customer={customer} customers={customers} items={draft.items} ready={draft.ready}
          loading={draft.loading} quote={quote} inventory={inventory} couponCode={activeMetadata.couponCode} note={activeMetadata.note}
          busy={busy} checkingOut={mutation === "checkout"} problem={checkoutProblems[customerId] ?? null} confirmation={activeConfirmation}
          onCustomerChange={selectCustomer}
          onQuantityChange={(id, quantity) => { changeDraft(() => draft.replace(customerId, setLineQuantity(draft.items, id, quantity))); }}
          onRemove={(id) => { changeDraft(() => draft.replace(customerId, removeCartLine(draft.items, id))); }}
          onCouponChange={(couponCode) => changeMetadata({ couponCode })} onNoteChange={(note) => changeMetadata({ note })}
          onCheckout={() => { void checkout(); }} onAcknowledgeUncertainty={acknowledgeUncertainty}
          onShop={() => navigate("shop")} onViewOrders={reviewCustomerOrders} onViewOrder={openOrder}
          onDetails={(id) => setDialog({ kind: "details", id })} />}
        {view === "orders" && <Orders customers={customers} customerId={ordersCustomerId} onCustomerChange={setOrdersCustomerId}
          revision={revision} busy={busy} onOpen={openOrder} />}
        {view === "inventory" && <Inventory resource={inventory} busy={busy} onAdjust={(id) => setDialog({ kind: "adjust", id })}
          onEdit={(id) => setDialog({ kind: "edit", id })} />}

        <footer className="page-footer"><span><strong>Marketlane</strong> / Thoughtful goods for the working day.</span><span>Local workspace &middot; Prices in USD</span></footer>
      </main>
    </div>

    {dialog?.kind === "details" && <ProductDetails key={dialog.id} id={dialog.id} locale={locale} revision={revision} busy={busy}
      onClose={closeDialog} canAdd={canAdd} onAdd={add} onEdit={() => setDialog({ kind: "edit", id: dialog.id })} />}
    {dialog?.kind === "edit" && <ProductEditor key={dialog.id} id={dialog.id} locale={locale} revision={revision} busy={busy}
      onClose={closeDialog} onSave={saveProduct} />}
    {dialog?.kind === "adjust" && <InventoryAdjustmentDialog key={dialog.id} id={dialog.id} locale={locale} revision={revision} busy={busy}
      onClose={closeDialog} onSave={adjustInventory} />}
    {dialog?.kind === "order" && <OrderDetails key={dialog.id} id={dialog.id} revision={revision} busy={busy} onClose={closeDialog} onAdvance={advanceOrder} />}
  </div>;
}
