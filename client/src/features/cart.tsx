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
      setCouponError("쿠폰 코드를 입력하거나 현재 코드를 삭제해 주세요.");
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
      <div><p className="eyebrow">고른 물건들</p><h1>장바구니<span className="heading-count">{itemCount(items)}</span></h1>
        <p>일상에 필요한 물건을 한곳에 모았습니다.</p></div>
      <button className="button button-secondary" onClick={onShop} disabled={busy}>계속 둘러보기 <Icon name="arrow" size={17} /></button>
    </div>

    <div className="cart-customer panel">
      <div><span className="eyebrow">주문 고객</span><p>{customer ? `${customer.company} / ${customer.email}` : "주문할 고객을 선택해 주세요."}</p></div>
      <label className="field"><span className="sr-only">장바구니 고객</span>
        <select value={customer?.id ?? ""} onChange={(event) => onCustomerChange(event.target.value)} disabled={busy || customers.length === 0}>
          {!customer && <option value="">고객 선택</option>}
          {customers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
        </select>
      </label>
    </div>

    {confirmation && confirmation.customer.id === customer?.id && <section className="order-confirmation" aria-labelledby="confirmation-title" role="status">
      <span className="confirmation-icon"><Icon name="check" size={34} /></span>
      <p className="eyebrow">주문 {confirmation.number}</p>
      <h2 id="confirmation-title">주문이 접수되었습니다.</h2>
      <p><strong>{confirmation.customer.name}</strong>의 주문을 기록했습니다. 이제 포장을 진행할 수 있습니다.</p>
      <div className="confirmation-facts">
        <span>총 {itemCount(confirmation.items)}개</span><span>{formatMoney(confirmation.totals.totalCents)} USD</span><span><Timestamp value={confirmation.createdAt} withTime /></span>
      </div>
      <p className="small muted">실제 결제는 진행하지 않았습니다. 주문 화면에서 접수부터 발송까지 확인할 수 있습니다.</p>
      <div className="button-row">
        <button className="button button-primary" onClick={() => onViewOrder(confirmation.id)}>주문 보기 <Icon name="arrow" size={17} /></button>
        <button className="button button-secondary" onClick={onShop}>상품 목록으로</button>
      </div>
    </section>}

    {loading && <Loading label="고객의 장바구니를 복원하는 중..." />}
    {!loading && !ready && <EmptyState icon="cart" title={customer ? "저장된 장바구니를 확인해 주세요" : "고객을 선택해 주세요"}>
      {customer ? "위 알림에서 이 고객의 장바구니를 복구해 주세요. 다른 고객의 장바구니는 바뀌지 않습니다." : "고객마다 브라우저에 별도 장바구니가 저장됩니다. 고객을 선택해 주세요."}
    </EmptyState>}
    {ready && items.length === 0 && !confirmation && <EmptyState icon="cart" title="장바구니가 비어 있습니다"
      action={<button className="button button-primary" onClick={onShop}>상품 둘러보기 <Icon name="arrow" size={17} /></button>}>
      일하는 하루에 필요한 물건을 골라 보세요.
    </EmptyState>}

    {ready && items.length > 0 && <div className="cart-layout">
      <div className="cart-main">
        <Notice title="장바구니는 재고 예약이 아닙니다">주문 전까지 다른 고객도 구매할 수 있습니다. 주문 시점에 가격과 재고를 다시 확인합니다.</Notice>
        {inventory.error !== null && <ErrorState title="상품 정보와 재고를 불러오지 못했습니다" error={inventory.error} onRetry={inventory.reload} />}
        {inventory.loading && <div className="inline-loading" role="status"><span className="spinner" />상품 정보와 현재 재고를 불러오는 중...</div>}
        <section className="cart-items panel" aria-label="장바구니 상품">
          <div className="cart-items-heading"><h2>담은 상품</h2><span>{items.length}종</span></div>
          {items.map((item) => {
            const product = products.get(item.productId);
            const line = quotedLines.get(item.productId);
            const name = product?.name ?? line?.name ?? item.productId;
            const invalid = invalidInputs.has(item.productId);
            const inputId = `quantity-${encodeURIComponent(item.productId)}`;
            return <article className="cart-item" key={item.productId}>
              <button className="cart-item-image" onClick={() => onDetails(item.productId)} disabled={busy}
                aria-label={`${name} 상세 보기`}>
                {product ? <ProductArt shape={product.shape} tone={product.tone} /> : <Icon name="inventory" size={30} />}
              </button>
              <div className="cart-item-content">
                <span className="product-category">{product?.sku ?? line?.sku ?? "상품 정보 없음"}</span>
                <h3><button className="product-name-button" onClick={() => onDetails(item.productId)} disabled={busy}
                  lang={product?.contentLocale}>{name}</button></h3>
                {product && <div className="cart-item-stock"><span>재고 {product.stockOnHand}개 &middot; 예약되지 않음</span><LanguageBadge product={product} /></div>}
                {!product && inventory.data && <p className="field-error">현재 재고에 없는 상품입니다. 삭제한 뒤 진행해 주세요.</p>}
                <div className="cart-quantity-row">
                  <div className={`quantity-control ${invalid ? "quantity-invalid" : ""}`}>
                    <button className="quantity-button" disabled={busy || item.quantity <= 1}
                      aria-label={`${name} 수량 줄이기`} onClick={() => updateQuantity(item.productId, String(item.quantity - 1))}><Icon name="minus" size={14} /></button>
                    <label className="sr-only" htmlFor={inputId}>{name} 수량</label>
                    <input id={inputId} inputMode="numeric" value={invalidInputs.get(item.productId) ?? String(item.quantity)}
                      onChange={(event) => updateQuantity(item.productId, event.target.value)} disabled={busy}
                      aria-invalid={invalid} aria-describedby={invalid ? `${inputId}-error` : undefined} />
                    <button className="quantity-button" disabled={busy || item.quantity >= MAX_QUANTITY}
                      aria-label={`${name} 수량 늘리기`} onClick={() => updateQuantity(item.productId, String(item.quantity + 1))}><Icon name="plus" size={14} /></button>
                  </div>
                  <button className="text-button remove-button" disabled={busy} onClick={() => { clearInput(item.productId); onRemove(item.productId); }}
                    aria-label={`${name} 장바구니에서 삭제`}><Icon name="trash" size={15} />삭제</button>
                </div>
                {invalid && <p className="field-error" id={`${inputId}-error`}>1~{MAX_QUANTITY} 사이의 정수를 입력해 주세요. 아직 반영되지 않았습니다.</p>}
              </div>
              <div className="cart-item-price">
                {line ? <><strong>{formatMoney(line.lineTotalCents)}</strong><span>개당 {formatMoney(line.unitPriceCents)}</span>
                  {line.discountCents > 0 && <small>{formatMoney(line.discountCents)} 할인</small>}</>
                  : <span className="muted">{quote.loading ? "계산 중..." : "견적 대기 중"}</span>}
              </div>
            </article>;
          })}
        </section>

        <section className="panel order-note-panel">
          <label className="field">주문 메모 <span className="muted">(선택)</span>
            <textarea rows={3} maxLength={500} value={note} onChange={(event) => onNoteChange(event.target.value)}
              placeholder="주문 처리 시 참고할 내용을 적어 주세요." disabled={busy} />
            <span className="field-hint">주문 snapshot에 포함됩니다. 제출 전 메모와 쿠폰은 이 탭에만 보관됩니다.</span>
          </label>
        </section>
      </div>

      <aside className="cart-summary" aria-labelledby="summary-title">
        <div className="panel quote-panel">
          <div className="quote-heading"><h2 id="summary-title">주문 요약</h2><span className="currency-label">USD</span></div>
          <form className="coupon-form" onSubmit={applyCoupon}>
            <label className="field" htmlFor="coupon-code">쿠폰 코드</label>
            <div className="coupon-input-row"><input id="coupon-code" value={couponInput}
              onChange={(event) => { setCouponInput(event.target.value); setCouponError(null); }}
              placeholder="코드 입력" autoCapitalize="characters" autoComplete="off" maxLength={40} disabled={busy} />
              <button className="button button-secondary" disabled={busy || !couponInput.trim()}>적용</button></div>
            {couponError && <p className="field-error" role="alert">{couponError}</p>}
          </form>
          {couponCode && <div className="coupon-chip"><Icon name="tag" size={16} /><strong>{couponCode}</strong>
            <span>{quote.data?.coupon ? "적용됨" : quote.error !== null ? "적용 안 됨" : "확인 중..."}</span>
            <button className="icon-button" aria-label="쿠폰 삭제" disabled={busy}
              onClick={() => { setCouponInput(""); setCouponError(null); onCouponChange(""); }}><Icon name="close" size={15} /></button>
          </div>}
          <p className="coupon-tip">WELCOME10: 상품 금액 $50 이상이면 10% 할인.</p>

          {quote.loading && !hasInvalidQuantities && <div className="quote-loading" role="status"><span className="spinner" />현재 가격 계산 중...</div>}
          {quote.error !== null && <Notice tone="error" title="견적을 다시 확인해 주세요">{errorMessage(quote.error)} 수정할 수 있도록 담은 상품은 보관했습니다.</Notice>}
          {currentQuote && <TotalsBreakdown totals={currentQuote.totals} couponCode={currentQuote.coupon?.code ?? null} />}
          {hasInvalidQuantities && <p className="unquoted-total">수량을 수정하면 합계를 확인할 수 있습니다.</p>}
          {!quote.loading && !quote.data && !hasInvalidQuantities && <p className="unquoted-total">모든 상품과 쿠폰의 견적을 계산해야 합계가 표시됩니다.</p>}
          {currentQuote && <p className="quote-timestamp"><Icon name="clock" size={14} />견적 시각 <Timestamp value={currentQuote.quotedAt} withTime /></p>}
          <button className="text-button refresh-quote" onClick={quote.reload} disabled={busy || quote.loading || hasInvalidQuantities}>
            <Icon name="refresh" size={15} />견적 새로고침
          </button>

          {problem && <Notice tone={problem.uncertain ? "warning" : "error"}
            title={problem.uncertain ? "주문 접수 여부를 확인하지 못했습니다" : "주문이 접수되지 않았습니다"}
            actions={<>
              <button className="button button-small button-secondary" onClick={onViewOrders} disabled={busy}>이 고객의 주문 확인</button>
              {problem.uncertain && <button className="text-button" onClick={onAcknowledgeUncertainty} disabled={busy}>
                주문 확인 완료, 새 주문 허용
              </button>}
            </>}>{problem.message}</Notice>}

          <button className="button button-primary checkout-button" disabled={!canCheckout} onClick={onCheckout}>
            {checkingOut ? <><span className="spinner" />주문 접수 중...</> : <><Icon name="cart" size={18} />주문하기{currentQuote ? ` - ${formatMoney(currentQuote.totals.totalCents)}` : ""}</>}
          </button>
          {hasInvalidQuantities && <p className="field-error">수량을 수정한 뒤 주문해 주세요.</p>}
          <p className="checkout-disclaimer">{checkingOut
            ? "페이지를 닫지 마세요. 주문 전송 중에는 고객과 장바구니를 변경할 수 없습니다."
            : "주문만 기록하며 실제 결제는 하지 않습니다. 세금이나 환율 변환은 적용하지 않습니다."}</p>
        </div>
        <p className="cart-persistence-note"><Icon name="info" size={16} />고객별 브라우저 장바구니에는 상품 ID와 수량만 저장됩니다.</p>
      </aside>
    </div>}
  </div>;
}
