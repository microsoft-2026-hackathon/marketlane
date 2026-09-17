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
      <div><p className="eyebrow">물건의 흐름을 한눈에</p><h1>재고</h1><p>현재 수량과 변동 이력을 확인하세요.</p></div>
      <button className="button button-secondary" disabled={busy || resource.loading} onClick={resource.reload}><Icon name="refresh" size={17} />재고 새로고침</button>
    </div>
    <div className="operations-note"><Icon name="info" size={17} />주문 접수와 수동 조정 시 재고가 바뀝니다. 장바구니와 견적은 재고를 예약하지 않습니다.</div>
    {resource.loading && <Loading label="재고와 변동 이력 불러오는 중..." />}
    {resource.error !== null && <ErrorState title="재고를 불러오지 못했습니다" error={resource.error} onRetry={resource.reload} />}
    {inventory && <>
      <div className="inventory-highlights">
        <button className={stock === "all" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("all")} aria-pressed={stock === "all"}>
          <Icon name="inventory" /><span>관리 상품<strong>{inventory.items.length}</strong></span>
        </button>
        <button className={stock === "low" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("low")} aria-pressed={stock === "low"}>
          <Icon name="alert" /><span>부족 기준 이하<strong>{inventory.items.filter((product) => product.stockOnHand <= product.lowStockThreshold).length}</strong></span>
        </button>
        <button className={stock === "out" ? "inventory-highlight selected" : "inventory-highlight"} onClick={() => setStock("out")} aria-pressed={stock === "out"}>
          <Icon name="cart" /><span>품절<strong>{inventory.items.filter((product) => product.stockOnHand === 0).length}</strong></span>
        </button>
      </div>
      <section className="panel stock-panel" aria-labelledby="stock-title">
        <div className="panel-heading">
          <div><h2 id="stock-title">현재 재고</h2><p className="small muted">상품 {products.length}개 표시</p></div>
          <div className="table-filters">
            <div className="search-field"><Icon name="search" size={17} /><label className="sr-only" htmlFor="inventory-search">재고 검색</label>
              <input type="search" id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="상품명 또는 SKU..." /></div>
            <label className="sr-only" htmlFor="inventory-category">재고 분류</label>
            <select id="inventory-category" value={category} onChange={(event) => setCategory(event.target.value as Category | "")}>
              <option value="">전체 분류</option><option value="desk">Desk</option><option value="carry">Carry</option><option value="paper">Paper</option>
            </select>
          </div>
        </div>
        {products.length === 0 ? <EmptyState icon="search" title="조건에 맞는 재고가 없습니다"
          action={<button className="button button-secondary" onClick={() => { setSearch(""); setCategory(""); setStock("all"); }}>필터 초기화</button>}>
          검색어, 분류 또는 재고 상태를 바꿔 보세요.
        </EmptyState> : <div className="table-scroll" role="region" aria-label="상품 재고" tabIndex={0}>
          <table className="data-table inventory-table">
            <thead><tr><th scope="col">상품</th><th scope="col">분류</th><th scope="col" className="align-right">단가</th><th scope="col">재고</th><th scope="col" className="align-right">관리</th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.id}>
              <td><div className="inventory-product"><div className="inventory-thumbnail"><ProductArt shape={product.shape} tone={product.tone} /></div>
                <div><strong className="cell-name" lang={product.contentLocale}>{product.name}</strong><span className="cell-secondary">{product.sku}</span><LanguageBadge product={product} /></div></div></td>
              <td><span className="category-pill">{categoryLabels[product.category]}</span>{product.featured && <span className="cell-secondary">추천</span>}</td>
              <td className="align-right money-cell">{formatMoney(product.priceCents)}</td>
              <td><div className="stock-cell"><strong>{product.stockOnHand}</strong><StockBadge product={product} /></div><span className="cell-secondary">{product.lowStockThreshold}개 이하 시 부족</span></td>
              <td><div className="table-actions">
                <button className="button button-small button-secondary" onClick={() => onAdjust(product.id)} disabled={busy}
                  aria-label={`${product.name} 재고 조정`}><Icon name="plus" size={15} />조정</button>
                <button className="icon-button" onClick={() => onEdit(product.id)} disabled={busy} aria-label={`${product.name} 수정`} title="상품 수정"><Icon name="edit" size={17} /></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      <section className="panel ledger-panel" aria-labelledby="ledger-title">
        <div className="panel-heading">
          <div><span className="eyebrow">변동 기록</span><h2 id="ledger-title">재고 변동 이력</h2><p className="small muted">초기 재고, 주문 접수, 수동 조정을 최신순으로 표시합니다.</p></div>
          <label className="inline-select">상품
            <select value={movementProduct} onChange={(event) => setMovementProduct(event.target.value)}>
              <option value="">전체 상품</option>
              {inventory.items.map((product) => <option key={product.id} value={product.id}>{product.sku} / {product.name}</option>)}
            </select>
          </label>
        </div>
        {movements.length === 0 ? <EmptyState icon="clock" title="변동 이력이 없습니다">선택한 상품의 재고 변동이 여기에 표시됩니다.</EmptyState>
          : <div className="table-scroll" role="region" aria-label="재고 변동 이력" tabIndex={0}>
            <table className="data-table ledger-table">
              <thead><tr><th scope="col">시각</th><th scope="col">상품</th><th scope="col" className="align-right">변동</th><th scope="col">사유</th><th scope="col">Reference</th></tr></thead>
              <tbody>{movements.map((movement) => <tr key={movement.id}>
                <td className="date-cell"><Timestamp value={movement.createdAt} withTime /></td>
                <td><strong className="cell-name">{productNames.get(movement.productId) ?? movement.sku}</strong><span className="cell-secondary">{movement.sku}</span></td>
                <td className="align-right"><span className={`movement-delta ${movement.delta > 0 ? "delta-positive" : "delta-negative"}`}>{movement.delta > 0 ? "+" : ""}{movement.delta}</span></td>
                <td className="ledger-reason">{movement.reason === "Opening balance" ? "초기 재고" : movement.reason}</td><td className="ledger-reference">{movement.reference || <span className="muted">없음</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        <div className="table-footer">변동 이력 {movements.length}건 표시</div>
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
  return <Modal title="재고 조정" eyebrow={product?.sku ?? "재고"} onClose={onClose} busy={busy}>
    {resource.loading && <Loading label="현재 재고 불러오는 중..." />}
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
      if (reason.trim().length < 3) throw new Error("변경을 추적할 수 있도록 사유를 3자 이상 입력해 주세요.");
      if (product.stockOnHand + adjustment < 0) throw new Error(`현재 재고는 ${product.stockOnHand}개입니다. 0 미만으로 조정할 수 없습니다.`);
      if (!Number.isSafeInteger(product.stockOnHand + adjustment)) throw new Error("조정 후 재고가 지원 범위를 벗어납니다.");
      await onSave({ productId: product.id, delta: adjustment, reason: reason.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}) });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return <form className="stack-form" onSubmit={(event) => { void submit(event); }}>
    <div className="adjustment-product"><div className="inventory-thumbnail"><ProductArt shape={product.shape} tone={product.tone} /></div>
      <div><h3 lang={product.contentLocale}>{product.name}</h3><p className="small muted">{product.sku} / {categoryLabels[product.category]}</p></div></div>
    <label className="field">수량 변동
      <input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="+12 또는 -3" required disabled={busy} autoComplete="off" />
      <span className="field-hint">입고는 양수, 출고는 음수로 입력합니다. 정수만 허용하며, 한 번에 최대 10,000개까지 조정할 수 있습니다. 0은 허용하지 않습니다.</span>
    </label>
    <div className={`stock-preview ${projected !== null && projected < 0 ? "stock-preview-invalid" : ""}`}>
      <div><span>현재 재고</span><strong>{product.stockOnHand}</strong></div><Icon name="arrow" />
      <div><span>조정 후</span><strong>{projected === null || !Number.isSafeInteger(projected) ? "--" : projected}</strong></div>
    </div>
    <label className="field">사유
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 추가 입고" required minLength={3} maxLength={240} disabled={busy} />
    </label>
    <label className="field">Reference <span className="muted">(선택)</span>
      <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="입고·실사·공급업체 참조 번호" maxLength={80} disabled={busy} />
    </label>
    <Notice>재고를 즉시 변경하고 이력을 남깁니다. Reference는 설명용이며, 다시 제출하면 별도 조정으로 기록됩니다.</Notice>
    {error && <Notice tone="error" title="조정 결과를 확인하지 못했습니다">{error} 연결이 끊겼다면 재시도 전에 변동 이력을 확인해 주세요.</Notice>}
    <div className="form-footer">
      <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>취소</button>
      <button className={`button ${deltaNumber !== null && deltaNumber < 0 ? "button-danger" : "button-primary"}`} disabled={busy}>
        {busy ? <><span className="spinner" />기록 중...</> : "조정 기록"}
      </button>
    </div>
  </form>;
}
