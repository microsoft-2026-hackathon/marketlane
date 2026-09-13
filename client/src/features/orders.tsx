import { useState } from "react";
import type { Customer, OrderStatus } from "../../../shared/contracts.js";
import { api, errorMessage } from "../api.js";
import { useResource } from "../hooks/use-resource.js";
import { itemCount } from "../lib/cart-state.js";
import { formatMoney } from "../lib/money.js";
import { Icon } from "../components/icon.js";
import { categoryLabels, EmptyState, ErrorState, Loading, Modal, Notice, StatusBadge, statusLabels, Timestamp, TotalsBreakdown } from "../components/ui.js";

export function Orders({ customers, customerId, onCustomerChange, revision, busy, onOpen }: {
  customers: Customer[];
  customerId: string;
  onCustomerChange: (id: string) => void;
  revision: number;
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const resource = useResource(`orders:${customerId}:${status}:${revision}`, (signal) => api.orders(customerId, status, signal));
  return <div className="orders-view">
    <div className="page-heading">
      <div><p className="eyebrow">FROM OUR SHELF TO THEIR DESK</p><h1>Orders</h1><p>Every good day starts with a little follow-through.</p></div>
      <button className="button button-secondary" onClick={resource.reload} disabled={busy || resource.loading}><Icon name="refresh" size={17} />Refresh orders</button>
    </div>
    <div className="operations-note"><Icon name="info" size={17} />Orders are accepted records, not payment receipts. Fulfillment follows placed, packing, then shipped.</div>
    <section className="panel orders-panel" aria-labelledby="order-list-title">
      <div className="panel-heading">
        <div><h2 id="order-list-title">Order desk</h2><p className="muted small">The latest 100 orders matching your filters.</p></div>
        <label className="inline-select">Customer
          <select value={customerId} onChange={(event) => onCustomerChange(event.target.value)} disabled={busy}>
            <option value="">All customers</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
      </div>
      <div className="orders-toolbar">
        <div className="segmented-control" aria-label="Order status">
          {(["", "placed", "packing", "shipped"] as const).map((value) => <button key={value}
            className={value === status ? "selected" : ""} aria-pressed={value === status} disabled={busy}
            onClick={() => setStatus(value)}>{value ? statusLabels[value] : "All orders"}</button>)}
        </div>
        <span className="muted small" aria-live="polite">{resource.data ? `${resource.data.items.length} shown` : ""}</span>
      </div>
      {resource.loading && <Loading label="Loading orders..." />}
      {resource.error !== null && <div className="panel-inset"><ErrorState error={resource.error} onRetry={resource.reload} /></div>}
      {resource.data?.items.length === 0 && <EmptyState icon="orders" title="No orders in this view"
        action={(status || customerId) ? <button className="button button-secondary" onClick={() => { setStatus(""); onCustomerChange(""); }}>Clear filters</button> : undefined}>
        {status || customerId ? "Try another status or customer to find the order you need." : "Orders will appear here once a customer checks out."}
      </EmptyState>}
      {resource.data && resource.data.items.length > 0 && <div className="table-scroll" role="region" aria-label="Order list" tabIndex={0}>
        <table className="data-table orders-table">
          <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Placed</th><th scope="col" className="align-right">Total</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
          <tbody>{resource.data.items.map((order) => <tr key={order.id}>
            <td><button className="table-link" onClick={() => onOpen(order.id)} disabled={busy}>{order.number}</button><span className="cell-secondary">{itemCount(order.items)} items</span></td>
            <td><strong className="cell-name">{order.customer.name}</strong><span className="cell-secondary">{order.customer.company}</span></td>
            <td><StatusBadge status={order.status} /></td>
            <td className="date-cell"><Timestamp value={order.createdAt} withTime /></td>
            <td className="align-right money-cell">{formatMoney(order.totals.totalCents)}</td>
            <td><button className="icon-button" onClick={() => onOpen(order.id)} disabled={busy} aria-label={`View order ${order.number}`}><Icon name="arrow" size={18} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}

export function OrderDetails({ id, revision, busy, onClose, onAdvance }: {
  id: string;
  revision: number;
  busy: boolean;
  onClose: () => void;
  onAdvance: (id: string, status: "packing" | "shipped") => Promise<void>;
}) {
  const resource = useResource(`order:${id}:${revision}`, (signal) => api.order(id, signal));
  const [confirmTarget, setConfirmTarget] = useState<"packing" | "shipped" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const order = resource.data?.order;

  async function advance() {
    if (!order || !confirmTarget) {
      setError("Reload the order before changing its status.");
      return;
    }
    setError(null);
    try {
      await onAdvance(order.id, confirmTarget);
      setConfirmTarget(null);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return <Modal title={order?.number ?? "Order details"} eyebrow="ORDER RECORD" onClose={onClose} busy={busy} wide>
    {resource.loading && <Loading label="Opening the order record..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {order && <>
      <div className="order-detail-header">
        <div><StatusBadge status={order.status} /><span className="muted small">Placed <Timestamp value={order.createdAt} withTime /></span></div>
        <strong className="order-detail-total">{formatMoney(order.totals.totalCents)} <span>USD</span></strong>
      </div>
      <ol className="fulfillment-timeline" aria-label="Fulfillment progress">
        {([
          { status: "placed", time: order.createdAt, icon: "check" },
          { status: "packing", time: order.packedAt, icon: "inventory" },
          { status: "shipped", time: order.shippedAt, icon: "truck" },
        ] as const).map((step) => <li key={step.status} className={step.time ? "step-complete" : ""}
          aria-current={order.status === step.status ? "step" : undefined}>
          <span className="step-icon"><Icon name={step.icon} size={19} /></span>
          <strong>{statusLabels[step.status]}</strong><span>{step.time ? <Timestamp value={step.time} withTime /> : "Not yet"}</span>
        </li>)}
      </ol>

      <div className="order-snapshot-meta">
        <div><span className="eyebrow">CUSTOMER AT CHECKOUT</span><strong>{order.customer.name}</strong>
          <span>{order.customer.company}</span><span>{order.customer.email}</span></div>
        <div><span className="eyebrow">ORDER DETAILS</span><span>{itemCount(order.items)} items / {order.items.length} products</span>
          <span>Catalog language: {order.locale === "ko" ? "Korean" : "English"}</span><span>{order.couponCode ? `Coupon: ${order.couponCode}` : "No coupon used"}</span></div>
      </div>
      <div className="snapshot-label"><Icon name="clock" size={16} /><span>Saved at checkout. Later product or customer edits do not change this record.</span></div>
      <div className="table-scroll" role="region" aria-label="Order item snapshots" tabIndex={0}>
        <table className="data-table order-lines-table">
          <thead><tr><th scope="col">Product</th><th scope="col" className="align-right">Qty</th><th scope="col" className="align-right">Unit price</th><th scope="col" className="align-right">Discount</th><th scope="col" className="align-right">Line total</th></tr></thead>
          <tbody>{order.items.map((line) => <tr key={line.productId}>
            <td><strong className="cell-name">{line.name}</strong><span className="cell-secondary">{line.sku} / {categoryLabels[line.category]}</span></td>
            <td className="align-right">{line.quantity}</td><td className="align-right">{formatMoney(line.unitPriceCents)}</td>
            <td className="align-right">{line.discountCents > 0 ? `-${formatMoney(line.discountCents)}` : formatMoney(0)}</td>
            <td className="align-right money-cell">{formatMoney(line.lineTotalCents)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="order-detail-bottom">
        <div className="order-snapshot-note"><span className="eyebrow">ORDER NOTE</span>
          <p>{order.note || "No note was included with this order."}</p></div>
        <div><TotalsBreakdown totals={order.totals} couponCode={order.couponCode} /></div>
      </div>

      <section className="fulfillment-actions" aria-labelledby="fulfillment-actions-title">
        <div><h3 id="fulfillment-actions-title">{order.status === "shipped" ? "Fulfillment complete" : "Next step"}</h3>
          <p className="small muted">{order.status === "placed" ? "Begin preparing the items for this customer."
            : order.status === "packing" ? "Mark as shipped only after the goods have left your workspace."
            : "This order has been marked as shipped. No further transition is available."}</p></div>
        {!confirmTarget && order.status !== "shipped" && <button className="button button-primary" disabled={busy}
          onClick={() => { setError(null); setConfirmTarget(order.status === "placed" ? "packing" : "shipped"); }}>
          <Icon name={order.status === "placed" ? "inventory" : "truck"} size={18} />{order.status === "placed" ? "Start packing" : "Mark as shipped"}
        </button>}
        {confirmTarget && <Notice tone="warning" title={confirmTarget === "packing" ? "Move this order to packing?" : "Confirm this order has shipped"}
          actions={<>
            <button className="button button-small button-secondary" disabled={busy} onClick={() => setConfirmTarget(null)}>Not yet</button>
            <button className="button button-small button-primary" disabled={busy} onClick={() => { void advance(); }}>
              {busy ? <><span className="spinner" />Updating...</> : confirmTarget === "packing" ? "Confirm packing" : "Confirm shipment"}
            </button>
          </>}>
          Status changes cannot be reversed. Stock was already deducted when the order was placed; this action will not deduct it again.
        </Notice>}
        {error && <Notice tone="error" title="Status could not be updated" actions={
          <button className="text-button" disabled={busy} onClick={() => { setError(null); setConfirmTarget(null); resource.reload(); }}>Reload the order</button>
        }>{error}</Notice>}
      </section>
    </>}
  </Modal>;
}
