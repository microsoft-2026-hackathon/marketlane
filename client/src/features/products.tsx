import { useEffect, useState, type FormEvent } from "react";
import type { Locale, Product, ProductUpdate } from "../../../shared/contracts.js";
import { api, errorMessage } from "../api.js";
import { useResource } from "../hooks/use-resource.js";
import { MAX_QUANTITY, quantityFromInput } from "../lib/cart-state.js";
import { formatMoney, parsePriceCents, priceInputValue } from "../lib/money.js";
import { Icon } from "../components/icon.js";
import { ProductArt } from "../components/product-art.js";
import { categoryLabels, ErrorState, LanguageBadge, Loading, Modal, Notice, StockBadge } from "../components/ui.js";

interface ProductDialogProps {
  id: string;
  locale: Locale;
  revision: number;
  busy: boolean;
  onClose: () => void;
}

export function ProductDetails({ id, locale, revision, busy, onClose, canAdd, onAdd, onEdit }: ProductDialogProps & {
  canAdd: boolean;
  onAdd: (product: Product, quantity: number) => string | null;
  onEdit: () => void;
}) {
  const resource = useResource(`product:${id}:${locale}:${revision}`, (signal) => api.product(id, locale, signal));
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const product = resource.data?.product;
  function add(event: FormEvent) {
    event.preventDefault();
    const units = quantityFromInput(quantity);
    if (units === null) {
      setError(`Choose a whole quantity between 1 and ${MAX_QUANTITY}.`);
      return;
    }
    if (product) {
      setError(null);
      const failure = onAdd(product, units);
      if (failure) setError(failure);
    }
  }
  return <Modal title={product?.name ?? "Product details"} eyebrow={product ? `${categoryLabels[product.category]} / ${product.sku}` : "THE COLLECTION"}
    onClose={onClose} busy={busy} wide>
    {resource.loading && <Loading label="Opening product..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {product && <div className="product-detail">
      <div className="product-detail-art"><ProductArt shape={product.shape} tone={product.tone} /></div>
      <div className="product-detail-copy">
        <div className="badge-row"><StockBadge product={product} /><LanguageBadge product={product} /></div>
        <p className="detail-price">{formatMoney(product.priceCents)} <span>USD</span></p>
        <p className="detail-description" lang={product.contentLocale}>{product.description}</p>
        <dl className="product-facts">
          <div><dt>SKU</dt><dd>{product.sku}</dd></div>
          <div><dt>Available now</dt><dd>{product.stockOnHand} units</dd></div>
          <div><dt>Content language</dt><dd>{product.contentLocale === "ko" ? "Korean" : "English"}</dd></div>
        </dl>
        <form onSubmit={add} className="product-add-form">
          <label className="field quantity-field">Quantity
            <input inputMode="numeric" value={quantity} onChange={(event) => { setQuantity(event.target.value); setError(null); }}
              disabled={busy || !canAdd || product.stockOnHand === 0} aria-invalid={error !== null} />
          </label>
          <button className="button button-primary" disabled={busy || !canAdd || product.stockOnHand === 0}>
            <Icon name="plus" size={18} />{product.stockOnHand === 0 ? "Out of stock" : "Add to cart"}
          </button>
        </form>
        {error && <p className="field-error" role="alert">{error}</p>}
        {!canAdd && <p className="muted small">Select a customer and resolve any saved-cart notice before adding items.</p>}
        <p className="small muted">Adding to your cart does not reserve stock. Availability and prices are checked at checkout.</p>
        <button className="text-button edit-product-link" onClick={onEdit} disabled={busy}><Icon name="edit" size={16} />Edit product content &amp; price</button>
      </div>
    </div>}
  </Modal>;
}

export function ProductEditor({ id, locale, revision, busy, onClose, onSave }: ProductDialogProps & {
  onSave: (id: string, update: ProductUpdate) => Promise<void>;
}) {
  const [editLocale, setEditLocale] = useState<Locale>(locale);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const resource = useResource(`edit-product:${id}:${editLocale}:${revision}`, (signal) => api.product(id, editLocale, signal));
  const product = resource.data?.product;
  const requestClose = () => { if (dirty) setConfirmDiscard(true); else onClose(); };
  return <Modal title="Edit product" eyebrow={product?.sku ?? "CATALOG CONTENT"} onClose={requestClose} busy={busy}>
    {confirmDiscard && <Notice tone="warning" title="Discard unsaved changes?" actions={<>
      <button className="button button-small button-secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
      <button className="button button-small button-danger" onClick={onClose}>Discard changes</button>
    </>}>Your edits have not been saved.</Notice>}
    <label className="field">Content language
      <select value={editLocale} disabled={busy || dirty} onChange={(event) => setEditLocale(event.target.value as Locale)}>
        <option value="en">English</option><option value="ko">Korean</option>
      </select>
      <span className="field-hint">{dirty ? "Save or reset your edits before switching language." : "Name and description are language-specific. Price and featured placement apply to both languages."}</span>
    </label>
    {resource.loading && <Loading label="Loading editable content..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {product && <ProductEditForm key={`${id}:${editLocale}`} product={product} locale={editLocale}
      busy={busy} onSave={onSave} onDirtyChange={setDirty} />}
  </Modal>;
}

function ProductEditForm({ product, locale, busy, onSave, onDirtyChange }: {
  product: Product;
  locale: Locale;
  busy: boolean;
  onSave: (id: string, update: ProductUpdate) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const translated = product.contentLocale === locale;
  const initialName = translated ? product.name : "";
  const initialDescription = translated ? product.description : "";
  const initialPrice = priceInputValue(product.priceCents);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState(initialPrice);
  const [featured, setFeatured] = useState(product.featured);
  const [error, setError] = useState<string | null>(null);
  const dirty = name !== initialName || description !== initialDescription || price !== initialPrice || featured !== product.featured;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  function reset() {
    setName(initialName);
    setDescription(initialDescription);
    setPrice(initialPrice);
    setFeatured(product.featured);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (name.trim().length < 2 || description.trim().length < 5) {
        throw new Error("Use at least 2 characters for the name and 5 for the description.");
      }
      const priceCents = parsePriceCents(price);
      await onSave(product.id, { locale, name: name.trim(), description: description.trim(), priceCents, featured });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return <form onSubmit={(event) => { void submit(event); }} className="stack-form">
    {!translated && <Notice title="Add a Korean translation">This product currently falls back to English. Add Korean content below; the English version will stay unchanged.</Notice>}
    <label className="field">Product name
      <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} disabled={busy} lang={locale} />
    </label>
    <label className="field">Description
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={5}
        minLength={5} maxLength={2000} disabled={busy} lang={locale} />
    </label>
    <label className="field">Unit price <span className="muted">(USD)</span>
      <div className="money-input"><span>$</span><input inputMode="decimal" value={price}
        onChange={(event) => setPrice(event.target.value)} required disabled={busy} aria-label="Unit price in USD" /></div>
      <span className="field-hint">From $0.01 to $100,000.00, with up to two decimal places. This changes future quotes and orders only.</span>
    </label>
    <label className="checkbox-label"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} disabled={busy} />
      Feature this product in the collection</label>
    {error && <Notice tone="error" title="Product could not be saved">{error}</Notice>}
    <div className="form-footer">
      <button type="button" className="button button-secondary" onClick={reset} disabled={busy || !dirty}>Reset edits</button>
      <button className="button button-primary" disabled={busy || !dirty}>{busy ? <><span className="spinner" />Saving...</> : "Save product"}</button>
    </div>
  </form>;
}
