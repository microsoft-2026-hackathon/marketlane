import { useEffect, useState } from "react";
import type { CatalogQuery, CatalogSort, Category, Locale, Product, StoreConfig } from "../../../shared/contracts.js";
import { api } from "../api.js";
import { useResource } from "../hooks/use-resource.js";
import { formatMoney } from "../lib/money.js";
import { Icon } from "../components/icon.js";
import { ProductArt, WorkspaceScene } from "../components/product-art.js";
import { categoryLabels, EmptyState, ErrorState, LanguageBadge, StockBadge } from "../components/ui.js";

interface ShopProps {
  locale: Locale;
  revision: number;
  config: StoreConfig | null;
  canAdd: boolean;
  busy: boolean;
  onAdd: (product: Product, quantity?: number) => void;
  onDetails: (id: string) => void;
  onEdit: (id: string) => void;
}

export function Shop({ locale, revision, config, canAdd, busy, onAdd, onDetails, onEdit }: ShopProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [sort, setSort] = useState<CatalogSort>("featured");
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const query: CatalogQuery = {
    locale, q: search, sort, inStock, page, pageSize,
    ...(category ? { category } : {}),
  };
  const catalog = useResource(`catalog:${JSON.stringify(query)}:${revision}`, (signal) => api.catalog(query, signal));

  useEffect(() => {
    if (catalog.data && page > Math.max(1, catalog.data.pageCount)) setPage(Math.max(1, catalog.data.pageCount));
  }, [catalog.data, page]);

  function resetFilters() {
    setSearch("");
    setCategory("");
    setInStock(false);
    setSort("featured");
    setPage(1);
  }

  return (
    <div className="shop-view">
      <section className="shop-hero" aria-labelledby="shop-title">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" />THE EVERYDAY, WELL CONSIDERED</span>
          <h1 id="shop-title">Make room for<br /><em>your best work.</em></h1>
          <p>Useful things, thoughtfully chosen. For the desk, the day, and everything in between.</p>
          <a className="hero-link" href="#collection">Find your everyday essentials <Icon name="arrow" size={18} /></a>
        </div>
        <div className="hero-art"><WorkspaceScene /><span className="hero-art-caption">A little order. A lot of possibility.</span></div>
      </section>

      <div className="shop-benefits">
        <span><Icon name="leaf" size={17} />Made for the working day</span>
        <span><Icon name="truck" size={17} />{config
          ? `Free shipping from ${formatMoney(config.freeShippingThresholdCents)} after discounts`
          : "Shipping calculated in your quote"}</span>
        <span><Icon name="globe" size={17} />English &amp; Korean catalog &middot; Always USD</span>
      </div>

      <section id="collection" className="collection-section" aria-labelledby="collection-title">
        <div className="section-heading">
          <div><p className="eyebrow">FIND YOUR EVERYDAY</p><h2 id="collection-title">The collection</h2></div>
          <div className="search-field">
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="catalog-search">Search products by name, description, or SKU</label>
            <input id="catalog-search" type="search" placeholder="Search goods or SKU..." maxLength={120}
              value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
        </div>

        <div className="catalog-controls">
          <div className="segmented-control" aria-label="Product category">
            {(["", "desk", "carry", "paper"] as const).map((value) => (
              <button key={value} className={category === value ? "selected" : ""} aria-pressed={category === value}
                onClick={() => { setCategory(value); setPage(1); }}>
                {value ? categoryLabels[value] : "All goods"}
              </button>
            ))}
          </div>
          <div className="catalog-selects">
            <label className="checkbox-label"><input type="checkbox" checked={inStock}
              onChange={(event) => { setInStock(event.target.checked); setPage(1); }} />In stock only</label>
            <label className="inline-select">Sort
              <select value={sort} onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className="collection-meta" aria-live="polite">
          <span>{catalog.loading ? "Finding your essentials..." : catalog.data
            ? `${catalog.data.total} ${catalog.data.total === 1 ? "product" : "products"}${search ? ` matching "${search}"` : ""}`
            : "Catalog unavailable"}</span>
          {(search || category || inStock || sort !== "featured") && <button className="text-button" onClick={resetFilters}>Reset filters</button>}
        </div>

        {catalog.error !== null && <ErrorState title="The collection could not be loaded" error={catalog.error} onRetry={catalog.reload} />}
        {catalog.loading && <div className="product-grid" aria-label="Loading products" aria-busy="true">
          {Array.from({ length: pageSize }, (_, index) => <div className="product-skeleton" key={index}>
            <div className="skeleton skeleton-art" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" />
          </div>)}
        </div>}
        {catalog.data?.items.length === 0 && <EmptyState icon="search" title="Nothing here just yet"
          action={<button className="button button-secondary" onClick={resetFilters}>Browse all goods</button>}>
          Try another search, choose a different category, or include out-of-stock products.
        </EmptyState>}
        {catalog.data && catalog.data.items.length > 0 && <>
          <div className="product-grid">
            {catalog.data.items.map((product) => <article className="product-card" key={product.id}>
              <div className="product-card-media">
                <button className="product-art-button" onClick={() => onDetails(product.id)} disabled={busy}
                  aria-label={`View ${product.name}`}>
                  <ProductArt shape={product.shape} tone={product.tone} />
                </button>
                {product.featured && <span className="featured-badge">A Marketlane pick</span>}
                <button className="product-edit-button icon-button" aria-label={`Edit ${product.name}`}
                  title="Edit product" disabled={busy} onClick={() => onEdit(product.id)}><Icon name="edit" size={17} /></button>
              </div>
              <div className="product-card-body">
                <span className="product-category">{categoryLabels[product.category]}</span>
                <h3><button className="product-name-button" onClick={() => onDetails(product.id)} disabled={busy}
                  lang={product.contentLocale}>{product.name}</button></h3>
                <p className="product-description" lang={product.contentLocale}>{product.description}</p>
                <div className="product-availability"><StockBadge product={product} /><LanguageBadge product={product} /></div>
                <div className="product-card-bottom">
                  <strong>{formatMoney(product.priceCents)}</strong>
                  <button className="button button-small button-add" onClick={() => onAdd(product)}
                    disabled={!canAdd || busy || product.stockOnHand === 0} aria-label={`Add ${product.name} to cart`}
                    title={!canAdd ? "Select a customer and recover any saved-cart issue first." : undefined}>
                    <Icon name="plus" size={17} />{product.stockOnHand === 0 ? "Sold out" : "Add"}
                  </button>
                </div>
              </div>
            </article>)}
          </div>
          <div className="pagination">
            <label className="inline-select">Per page
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                <option value={6}>6 products</option><option value={12}>12 products</option><option value={24}>24 products</option>
              </select>
            </label>
            <span className="pagination-range">{(catalog.data.page - 1) * catalog.data.pageSize + 1}&ndash;{(catalog.data.page - 1) * catalog.data.pageSize + catalog.data.items.length} of {catalog.data.total}</span>
            <div className="pagination-buttons">
              <button className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page">
                <Icon name="chevron" className="rotate-180" size={18} />
              </button>
              <span>Page {catalog.data.page} of {catalog.data.pageCount}</span>
              <button className="icon-button" disabled={page >= catalog.data.pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page">
                <Icon name="chevron" size={18} />
              </button>
            </div>
          </div>
        </>}
      </section>
    </div>
  );
}
