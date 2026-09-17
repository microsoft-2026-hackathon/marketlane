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
      setError(`1~${MAX_QUANTITY} 사이의 정수를 입력해 주세요.`);
      return;
    }
    if (product) {
      setError(null);
      const failure = onAdd(product, units);
      if (failure) setError(failure);
    }
  }
  return <Modal title={product?.name ?? "상품 상세"} eyebrow={product ? `${categoryLabels[product.category]} / ${product.sku}` : "상품 목록"}
    onClose={onClose} busy={busy} wide>
    {resource.loading && <Loading label="상품 불러오는 중..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {product && <div className="product-detail">
      <div className="product-detail-art"><ProductArt shape={product.shape} tone={product.tone} /></div>
      <div className="product-detail-copy">
        <div className="badge-row"><StockBadge product={product} /><LanguageBadge product={product} /></div>
        <p className="detail-price">{formatMoney(product.priceCents)} <span>USD</span></p>
        <p className="detail-description" lang={product.contentLocale}>{product.description}</p>
        <dl className="product-facts">
          <div><dt>SKU</dt><dd>{product.sku}</dd></div>
          <div><dt>현재 재고</dt><dd>{product.stockOnHand}개</dd></div>
          <div><dt>상품 정보 언어</dt><dd>{product.contentLocale === "ko" ? "한국어" : "English"}</dd></div>
        </dl>
        <form onSubmit={add} className="product-add-form">
          <label className="field quantity-field">수량
            <input inputMode="numeric" value={quantity} onChange={(event) => { setQuantity(event.target.value); setError(null); }}
              disabled={busy || !canAdd || product.stockOnHand === 0} aria-invalid={error !== null} />
          </label>
          <button className="button button-primary" disabled={busy || !canAdd || product.stockOnHand === 0}>
            <Icon name="plus" size={18} />{product.stockOnHand === 0 ? "품절" : "장바구니에 담기"}
          </button>
        </form>
        {error && <p className="field-error" role="alert">{error}</p>}
        {!canAdd && <p className="muted small">고객을 선택하고 저장된 장바구니 알림을 확인한 뒤 담아 주세요.</p>}
        <p className="small muted">장바구니에 담아도 재고는 예약되지 않습니다. 가격과 재고는 주문 시 확인합니다.</p>
        <button className="text-button edit-product-link" onClick={onEdit} disabled={busy}><Icon name="edit" size={16} />상품 정보와 가격 수정</button>
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
  return <Modal title="상품 수정" eyebrow={product?.sku ?? "상품 정보"} onClose={requestClose} busy={busy}>
    {confirmDiscard && <Notice tone="warning" title="저장하지 않은 변경을 버릴까요?" actions={<>
      <button className="button button-small button-secondary" onClick={() => setConfirmDiscard(false)}>계속 수정</button>
      <button className="button button-small button-danger" onClick={onClose}>변경 버리기</button>
    </>}>수정 내용이 아직 저장되지 않았습니다.</Notice>}
    <label className="field">상품 정보 언어
      <select value={editLocale} disabled={busy || dirty} onChange={(event) => setEditLocale(event.target.value as Locale)}>
        <option value="en">English</option><option value="ko">한국어</option>
      </select>
      <span className="field-hint">{dirty ? "저장하거나 변경을 초기화한 뒤 언어를 바꿔 주세요." : "이름과 설명은 언어별로 저장합니다. 가격과 추천 여부는 두 언어에 공통 적용됩니다."}</span>
    </label>
    {resource.loading && <Loading label="수정할 정보 불러오는 중..." />}
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
        throw new Error("이름은 2자 이상, 설명은 5자 이상 입력해 주세요.");
      }
      const priceCents = parsePriceCents(price);
      await onSave(product.id, { locale, name: name.trim(), description: description.trim(), priceCents, featured });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return <form onSubmit={(event) => { void submit(event); }} className="stack-form">
    {!translated && <Notice title="한국어 번역 추가">현재 영어 fallback으로 표시되는 상품입니다. 한국어 정보를 추가해도 영어 정보는 바뀌지 않습니다.</Notice>}
    <label className="field">상품명
      <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} disabled={busy} lang={locale} />
    </label>
    <label className="field">설명
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={5}
        minLength={5} maxLength={2000} disabled={busy} lang={locale} />
    </label>
    <label className="field">단가 <span className="muted">(USD)</span>
      <div className="money-input"><span>$</span><input inputMode="decimal" value={price}
        onChange={(event) => setPrice(event.target.value)} required disabled={busy} aria-label="USD 단가" /></div>
      <span className="field-hint">$0.01~$100,000.00, 소수점 둘째 자리까지 입력합니다. 이후 견적과 주문에만 반영됩니다.</span>
    </label>
    <label className="checkbox-label"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} disabled={busy} />
      추천 상품으로 표시</label>
    {error && <Notice tone="error" title="상품을 저장하지 못했습니다">{error}</Notice>}
    <div className="form-footer">
      <button type="button" className="button button-secondary" onClick={reset} disabled={busy || !dirty}>변경 초기화</button>
      <button className="button button-primary" disabled={busy || !dirty}>{busy ? <><span className="spinner" />저장 중...</> : "상품 저장"}</button>
    </div>
  </form>;
}
