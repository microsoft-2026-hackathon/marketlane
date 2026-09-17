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
          <span className="eyebrow"><span className="eyebrow-line" />매일의 일을 위한 선택</span>
          <h1 id="shop-title">일하는 공간에<br /><em>여유를 더하세요.</em></h1>
          <p>책상 위부터 일상까지, 오래 곁에 둘 실용적인 물건을 골랐습니다.</p>
          <a className="hero-link" href="#collection">일상에 필요한 물건 찾기 <Icon name="arrow" size={18} /></a>
        </div>
        <div className="hero-art"><WorkspaceScene /><span className="hero-art-caption">정돈된 공간, 새로운 시작.</span></div>
      </section>

      <div className="shop-benefits">
        <span><Icon name="leaf" size={17} />일하는 하루를 위한 물건</span>
        <span><Icon name="truck" size={17} />{config
          ? `할인 후 ${formatMoney(config.freeShippingThresholdCents)} 이상 무료 배송`
          : "배송비는 견적에서 확인"}</span>
        <span><Icon name="globe" size={17} />한국어·English 상품 정보 &middot; USD 기준</span>
      </div>

      <section id="collection" className="collection-section" aria-labelledby="collection-title">
        <div className="section-heading">
          <div><p className="eyebrow">일상에 필요한 선택</p><h2 id="collection-title">상품 목록</h2></div>
          <div className="search-field">
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="catalog-search">상품명, 설명, SKU로 검색</label>
            <input id="catalog-search" type="search" placeholder="상품 또는 SKU 검색..." maxLength={120}
              value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
        </div>

        <div className="catalog-controls">
          <div className="segmented-control" aria-label="상품 분류">
            {(["", "desk", "carry", "paper"] as const).map((value) => (
              <button key={value} className={category === value ? "selected" : ""} aria-pressed={category === value}
                onClick={() => { setCategory(value); setPage(1); }}>
                {value ? categoryLabels[value] : "전체 상품"}
              </button>
            ))}
          </div>
          <div className="catalog-selects">
            <label className="checkbox-label"><input type="checkbox" checked={inStock}
              onChange={(event) => { setInStock(event.target.checked); setPage(1); }} />재고 있는 상품만</label>
            <label className="inline-select">정렬
              <select value={sort} onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }}>
                <option value="featured">추천순</option>
                <option value="price-asc">낮은 가격순</option>
                <option value="price-desc">높은 가격순</option>
                <option value="name">이름순</option>
              </select>
            </label>
          </div>
        </div>

        <div className="collection-meta" aria-live="polite">
          <span>{catalog.loading ? "상품을 찾는 중..." : catalog.data
            ? `${search ? `"${search}" 검색 결과: ` : ""}상품 ${catalog.data.total}개`
            : "상품 목록을 불러올 수 없습니다"}</span>
          {(search || category || inStock || sort !== "featured") && <button className="text-button" onClick={resetFilters}>필터 초기화</button>}
        </div>

        {catalog.error !== null && <ErrorState title="상품 목록을 불러오지 못했습니다" error={catalog.error} onRetry={catalog.reload} />}
        {catalog.loading && <div className="product-grid" aria-label="상품 불러오는 중" aria-busy="true">
          {Array.from({ length: pageSize }, (_, index) => <div className="product-skeleton" key={index}>
            <div className="skeleton skeleton-art" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" />
          </div>)}
        </div>}
        {catalog.data?.items.length === 0 && <EmptyState icon="search" title="조건에 맞는 상품이 없습니다"
          action={<button className="button button-secondary" onClick={resetFilters}>전체 상품 보기</button>}>
          검색어나 분류를 바꾸거나 품절 상품도 포함해 보세요.
        </EmptyState>}
        {catalog.data && catalog.data.items.length > 0 && <>
          <div className="product-grid">
            {catalog.data.items.map((product) => <article className="product-card" key={product.id}>
              <div className="product-card-media">
                <button className="product-art-button" onClick={() => onDetails(product.id)} disabled={busy}
                  aria-label={`${product.name} 상세 보기`}>
                  <ProductArt shape={product.shape} tone={product.tone} />
                </button>
                {product.featured && <span className="featured-badge">Marketlane 추천</span>}
                <button className="product-edit-button icon-button" aria-label={`${product.name} 수정`}
                  title="상품 수정" disabled={busy} onClick={() => onEdit(product.id)}><Icon name="edit" size={17} /></button>
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
                    disabled={!canAdd || busy || product.stockOnHand === 0} aria-label={`${product.name} 장바구니에 담기`}
                    title={!canAdd ? "고객을 선택하고 저장된 장바구니의 문제를 먼저 해결해 주세요." : undefined}>
                    <Icon name="plus" size={17} />{product.stockOnHand === 0 ? "품절" : "담기"}
                  </button>
                </div>
              </div>
            </article>)}
          </div>
          <div className="pagination">
            <label className="inline-select">페이지당
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                <option value={6}>6개</option><option value={12}>12개</option><option value={24}>24개</option>
              </select>
            </label>
            <span className="pagination-range">전체 {catalog.data.total}개 중 {(catalog.data.page - 1) * catalog.data.pageSize + 1}&ndash;{(catalog.data.page - 1) * catalog.data.pageSize + catalog.data.items.length}</span>
            <div className="pagination-buttons">
              <button className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="이전 페이지">
                <Icon name="chevron" className="rotate-180" size={18} />
              </button>
              <span>{catalog.data.page} / {catalog.data.pageCount} 페이지</span>
              <button className="icon-button" disabled={page >= catalog.data.pageCount} onClick={() => setPage((value) => value + 1)} aria-label="다음 페이지">
                <Icon name="chevron" size={18} />
              </button>
            </div>
          </div>
        </>}
      </section>
    </div>
  );
}
