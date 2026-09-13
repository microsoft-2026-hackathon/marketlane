import { useState, type FormEvent } from "react";
import type { Category, InventoryAdjustment, InventoryState, Locale, Product } from "../../../shared/contracts.js";
import { api, errorMessage } from "../api.js";
import { useResource, type Resource } from "../hooks/use-resource.js";
import { formatMoney, parseStockDelta, stockDeltaFromInput } from "../lib/money.js";
import { Icon } from "../components/icon.js";
import { ProductArt } from "../components/product-art.js";
import { categoryLabels, EmptyState, ErrorState, LanguageBadge, Loading, Modal, Notice, StockBadge, Timestamp } from "../components/ui.js";

export function Inventory({ resource, busy, onAdjust, onEdit }: {
  resource: Resource<InventoryState>;
  busy: boolean;
  onAdjust: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [stock, setStock] = useState<"all" | "low" | "out">("all");
  const [movementProduct, setMovementProduct] = useState("");
  const inventory = resource.data;
  const products = inventory?.items.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (!category || product.category === category)
      && (stock === "all" || (stock === "out" ? product.stockOnHand === 0 : product.stockOnHand <= product.lowStockThreshold));
  }) ?? [];
  const productNames = new Map(inventory?.items.map((product) => [product.id, product.name]));
  const movements = inventory?.movements.filter((movement) => !movementProduct || movement.productId === movementProduct)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)) ?? [];

  return <div className="inventory-view">
    <div className="page-heading">
      <div><p className="eyebrow">KEEP THE GOOD THINGS FLOWING</p><h1>Inventory</h1><p>A clear view of what is here, and how it got here.</p></div>
      <button className="button button-secondary" disabled={busy || resource.loading} onClick={resource.reload}><Icon name="refresh" size={17} />Refresh stock</button>
    </div>
    <div className="operations-note"><Icon name="info" size={17} />Stock changes when orders are placed or adjustments are recorded. Carts and quotes do not hold inventory.</div>
    {resource.loading && <Loading label="Loading stock and movement history..." />}
    {resource.error !== null && <ErrorState title="Inventory could not be loaded" error={resource.error} onRetry={resource.reload} />}
    {inventory && <>
      <div className="inventory-highlights">
        <button className={stock === "all" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("all")} aria-pressed={stock === "all"}>
          <Icon name="inventory" /><span>Products tracked<strong>{inventory.items.length}</strong></span>
        </button>
        <button className={stock === "low" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("low")} aria-pressed={stock === "low"}>
          <Icon name="alert" /><span>At or below threshold<strong>{inventory.items.filter((product) => product.stockOnHand <= product.lowStockThreshold).length}</strong></span>
        </button>
        <button className={stock === "out" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("out")} aria-pressed={stock === "out"}>
          <Icon name="cart" /><span>Out of stock<strong>{inventory.items.filter((product) => product.stockOnHand === 0).length}</strong></span>
        </button>
      </div>
      <section className="panel stock-panel" aria-labelledby="stock-title">
        <div className="panel-heading">
          <div><h2 id="stock-title">Stock on hand</h2><p className="small muted">{products.length} products in this view</p></div>
          <div className="table-filters">
            <div className="search-field"><Icon name="search" size={17} /><label className="sr-only" htmlFor="inventory-search">Search inventory</label>
              <input type="search" id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or SKU..." /></div>
            <label className="sr-only" htmlFor="inventory-category">Inventory category</label>
            <select id="inventory-category" value={category} onChange={(event) => setCategory(event.target.value as Category | "")}>
              <option value="">All categories</option><option value="desk">Desk</option><option value="carry">Carry</option><option value="paper">Paper</option>
            </select>
          </div>
        </div>
        {products.length === 0 ? <EmptyState icon="search" title="No stock matches this view"
          action={<button className="button button-secondary" onClick={() => { setSearch(""); setCategory(""); setStock("all"); }}>Reset filters</button>}>
          Try a different search, category, or stock indicator.
        </EmptyState> : <div className="table-scroll" role="region" aria-label="Product inventory" tabIndex={0}>
          <table className="data-table inventory-table">
            <thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col" className="align-right">Unit price</th><th scope="col">On hand</th><th scope="col" className="align-right">Manage</th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.id}>
              <td><div className="inventory-product"><div className="inventory-thumbnail"><ProductArt shape={product.shape} tone={product.tone} /></div>
                <div><strong className="cell-name" lang={product.contentLocale}>{product.name}</strong><span className="cell-secondary">{product.sku}</span><LanguageBadge product={product} /></div></div></td>
              <td><span className="category-pill">{categoryLabels[product.category]}</span>{product.featured && <span className="cell-secondary">Featured</span>}</td>
              <td className="align-right money-cell">{formatMoney(product.priceCents)}</td>
              <td><div className="stock-cell"><strong>{product.stockOnHand}</strong><StockBadge product={product} /></div><span className="cell-secondary">Low at {product.lowStockThreshold} or fewer</span></td>
              <td><div className="table-actions">
                <button className="button button-small button-secondary" onClick={() => onAdjust(product.id)} disabled={busy}
                  aria-label={`Adjust stock for ${product.name}`}><Icon name="plus" size={15} />Adjust</button>
                <button className="icon-button" onClick={() => onEdit(product.id)} disabled={busy} aria-label={`Edit ${product.name}`} title="Edit product"><Icon name="edit" size={17} /></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      <section className="panel ledger-panel" aria-labelledby="ledger-title">
        <div className="panel-heading">
          <div><span className="eyebrow">THE PAPER TRAIL</span><h2 id="ledger-title">Movement ledger</h2><p className="small muted">Opening balances, accepted orders, and manual adjustments. Newest first.</p></div>
          <label className="inline-select">Product
            <select value={movementProduct} onChange={(event) => setMovementProduct(event.target.value)}>
              <option value="">All products</option>
              {inventory.items.map((product) => <option key={product.id} value={product.id}>{product.sku} / {product.name}</option>)}
            </select>
          </label>
        </div>
        {movements.length === 0 ? <EmptyState icon="clock" title="No movements recorded">Recorded stock changes for this selection will appear here.</EmptyState>
          : <div className="table-scroll" role="region" aria-label="Inventory movement ledger" tabIndex={0}>
            <table className="data-table ledger-table">
              <thead><tr><th scope="col">When</th><th scope="col">Product</th><th scope="col" className="align-right">Change</th><th scope="col">Reason</th><th scope="col">Reference</th></tr></thead>
              <tbody>{movements.map((movement) => <tr key={movement.id}>
                <td className="date-cell"><Timestamp value={movement.createdAt} withTime /></td>
                <td><strong className="cell-name">{productNames.get(movement.productId) ?? movement.sku}</strong><span className="cell-secondary">{movement.sku}</span></td>
                <td className="align-right"><span className={`movement-delta ${movement.delta > 0 ? "delta-positive" : "delta-negative"}`}>{movement.delta > 0 ? "+" : ""}{movement.delta}</span></td>
                <td className="ledger-reason">{movement.reason}</td><td className="ledger-reference">{movement.reference || <span className="muted">No reference</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        <div className="table-footer">{movements.length} recorded {movements.length === 1 ? "movement" : "movements"} shown</div>
      </section>
    </>}
  </div>;
}

export function InventoryAdjustmentDialog({ id, locale, revision, busy, onClose, onSave }: {
  id: string;
  locale: Locale;
  revision: number;
  busy: boolean;
  onClose: () => void;
  onSave: (adjustment: InventoryAdjustment) => Promise<void>;
}) {
  const resource = useResource(`adjust:${id}:${locale}:${revision}`, (signal) => api.product(id, locale, signal));
  const product = resource.data?.product;
  return <Modal title="Adjust stock" eyebrow={product?.sku ?? "INVENTORY"} onClose={onClose} busy={busy}>
    {resource.loading && <Loading label="Loading current stock..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {product && <AdjustmentForm product={product} busy={busy} onSave={onSave} onClose={onClose} />}
  </Modal>;
}

function AdjustmentForm({ product, busy, onSave, onClose }: {
  product: Product;
  busy: boolean;
  onSave: (adjustment: InventoryAdjustment) => Promise<void>;
  onClose: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deltaNumber = stockDeltaFromInput(delta);
  const projected = deltaNumber === null ? null : product.stockOnHand + deltaNumber;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const adjustment = parseStockDelta(delta);
      if (reason.trim().length < 3) throw new Error("Include a reason of at least 3 characters so this change can be traced.");
      if (product.stockOnHand + adjustment < 0) throw new Error(`Only ${product.stockOnHand} units are currently available. Stock cannot go below zero.`);
      if (!Number.isSafeInteger(product.stockOnHand + adjustment)) throw new Error("The resulting stock is outside the supported range.");
      await onSave({ productId: product.id, delta: adjustment, reason: reason.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}) });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return <form className="stack-form" onSubmit={(event) => { void submit(event); }}>
    <div className="adjustment-product"><div className="inventory-thumbnail"><ProductArt shape={product.shape} tone={product.tone} /></div>
      <div><h3 lang={product.contentLocale}>{product.name}</h3><p className="small muted">{product.sku} / {categoryLabels[product.category]}</p></div></div>
    <label className="field">Quantity change
      <input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="+12 or -3" required disabled={busy} autoComplete="off" />
      <span className="field-hint">Use a positive whole number to add stock, or a negative whole number to remove it. Up to 10,000 units per adjustment; zero is not allowed.</span>
    </label>
    <div className={`stock-preview ${projected !== null && projected < 0 ? "stock-preview-invalid" : ""}`}>
      <div><span>Current stock</span><strong>{product.stockOnHand}</strong></div><Icon name="arrow" />
      <div><span>After adjustment</span><strong>{projected === null || !Number.isSafeInteger(projected) ? "--" : projected}</strong></div>
    </div>
    <label className="field">Reason
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example, received a replenishment" required minLength={3} maxLength={240} disabled={busy} />
    </label>
    <label className="field">Reference <span className="muted">(optional)</span>
      <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Delivery, count, or supplier reference" maxLength={80} disabled={busy} />
    </label>
    <Notice>This immediately changes available stock and adds a movement to the ledger. References are descriptive; submitting again records another adjustment.</Notice>
    {error && <Notice tone="error" title="Adjustment could not be confirmed">{error} If the connection was interrupted, inspect the ledger before submitting again.</Notice>}
    <div className="form-footer">
      <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button>
      <button className={`button ${deltaNumber !== null && deltaNumber < 0 ? "button-danger" : "button-primary"}`} disabled={busy}>
        {busy ? <><span className="spinner" />Recording...</> : "Record adjustment"}
      </button>
    </div>
  </form>;
}
