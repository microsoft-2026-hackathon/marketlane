import { useEffect, useRef, useState } from "react";
import type { CheckoutRequest, InventoryAdjustment, Locale, Order, Product, ProductUpdate, QuoteRequest } from "../../shared/contracts.js";
import { api, ApiError, errorMessage } from "./api.js";
import { useDraftCarts } from "./hooks/use-draft-carts.js";
import { useResource } from "./hooks/use-resource.js";
import { addCartLine, itemCount, quoteDraftKey, removeCartLine, sameCartLines, setLineQuantity } from "./lib/cart-state.js";
import { formatMoney } from "./lib/money.js";
import { BrandMark, Icon, type IconName } from "./components/icon.js";
import { OverviewStrip } from "./components/overview.js";
import { ErrorState, Notice, statusLabels } from "./components/ui.js";
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
  { view: "shop", label: "상품", icon: "shop" },
  { view: "cart", label: "장바구니", icon: "cart" },
  { view: "orders", label: "주문", icon: "orders" },
  { view: "inventory", label: "재고", icon: "inventory" },
];

export function App() {
  const [view, setView] = useState<View>("shop");
  const [locale, setLocale] = useState<Locale>("ko");
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
    document.title = `${navigation.find((entry) => entry.view === view)?.label ?? "상품"} - Marketlane`;
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
      setFlash({ tone: "error", message: "선택한 고객을 찾을 수 없습니다. 고객 목록을 다시 불러오세요.", cartLink: false });
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
    if (mutationOwner.current) return "진행 중인 작업이 끝난 뒤 장바구니를 변경해 주세요.";
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
      if (!customer || !draft.ready) throw new Error("고객을 선택하고 저장된 장바구니의 알림을 확인한 뒤 상품을 담아 주세요.");
      draft.replace(customerId, addCartLine(draft.items, product.id, quantity));
    });
    if (!failure) {
      setFlash({ tone: "success", message: `${customer?.name}의 장바구니에 ${product.name} ${quantity}개를 담았습니다.`, cartLink: true });
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
    if (mutationOwner.current) throw new Error("다른 작업이 진행 중입니다. 완료될 때까지 기다려 주세요.");
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
    setFlash({ tone: "success", message: `${result.product.sku} 수정 완료. 이후 견적과 주문에 반영됩니다.`, cartLink: false });
  }

  async function adjustInventory(adjustment: InventoryAdjustment) {
    const result = await performMutation("inventory", () => api.adjustInventory(adjustment));
    setDialog(null);
    setFlash({ tone: "success", message: `${result.product.sku}: 재고 변동 ${result.movement.delta > 0 ? "+" : ""}${result.movement.delta}개를 이력에 기록했습니다.`, cartLink: false });
  }

  async function advanceOrder(id: string, status: "packing" | "shipped") {
    const result = await performMutation("status", () => api.updateOrderStatus(id, status));
    setFlash({ tone: "success", message: `${result.order.number}: ${statusLabels[result.order.status]} 상태로 변경했습니다.`, cartLink: false });
  }

  async function checkout() {
    if (mutationOwner.current) return;
    if (!customer || !draft.ready || !quote.data || quote.loading || quoteKey === null || checkoutProblems[customerId]?.uncertain
      || quote.data.locale !== locale || !sameCartLines(quote.data.items, draft.items)) {
      setFlash({ tone: "error", message: "현재 고객의 장바구니에 유효한 견적이 필요합니다. 장바구니 알림을 확인한 뒤 주문해 주세요.", cartLink: true });
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
        throw new Error("서버의 주문 확인 내용이 전송한 장바구니와 일치하지 않습니다.");
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
            ? `${errorMessage(error)} 장바구니는 그대로 보관했습니다.`
            : `서버에서 이미 주문을 접수했을 수 있습니다. 장바구니는 보관했으며 자동 재시도하지 않았습니다. 다시 주문하기 전에 이 고객의 주문 목록을 확인해 주세요. ${errorMessage(error)}`,
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
    setFlash({ tone: "info", message: "견적 갱신 후 다시 주문할 수 있습니다. 이전 주문이 접수되지 않았을 때만 제출해 주세요. 성공한 요청마다 별도 주문이 생성됩니다.", cartLink: false });
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
    <a className="skip-link" href="#main-content">본문으로 이동</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("shop")} disabled={busy} aria-label="Marketlane 홈"><BrandMark /><span>Marketlane<small>WORKSPACE GOODS</small></span></button>
      <div className="sidebar-navigation">
        <p className="nav-section-label">일하는 공간</p>
        <nav aria-label="주 메뉴">
          {navigation.map((entry) => <button key={entry.view} className={`nav-item ${view === entry.view ? "active" : ""}`}
            aria-current={view === entry.view ? "page" : undefined} disabled={busy} onClick={() => navigate(entry.view)}>
            <Icon name={entry.icon} /><span>{entry.label}</span>
            {entry.view === "cart" && count > 0 && <span className="nav-count">{count}</span>}
            {entry.view === "orders" && overview.data && overview.data.openOrderCount > 0 && <span className="nav-order-count">{overview.data.openOrderCount}</span>}
          </button>)}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-message"><span className="sidebar-leaf"><Icon name="leaf" size={25} /></span><p>가볍게 정리하고<br /><strong>새롭게 시작하세요.</strong></p><span>일하는 하루를 위한<br />세심한 선택.</span></div>
        <div className="workspace-identity"><span className="workspace-dot" /><div><strong>로컬 workspace</strong><span>상품과 운영 관리</span></div></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{navigation.find((entry) => entry.view === view)?.label}</strong></div>
        <div className="topbar-controls">
          <label className="header-select"><Icon name="globe" size={17} /><span className="sr-only">상품 정보 언어</span>
            <select value={locale} disabled={busy} aria-label="상품 정보 언어" title="상품 정보의 언어만 바뀝니다. 가격은 USD 기준입니다."
              onChange={(event) => { if (!mutationOwner.current) setLocale(event.target.value as Locale); }}>
              <option value="en">English</option><option value="ko">한국어</option>
            </select>
          </label>
          <div className="customer-control"><span className="customer-avatar" aria-hidden="true">{customerInitials}</span>
            <label className="header-customer-select"><span>주문 고객</span>
              <select value={customer?.id ?? ""} disabled={busy || customers.length === 0} onChange={(event) => selectCustomer(event.target.value)} aria-label="주문 고객">
                {!customer && <option value="">{customerResource.loading ? "고객 불러오는 중..." : "고객 선택"}</option>}
                {customers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
              </select>
            </label>
          </div>
          <button className="header-cart" onClick={() => navigate("cart")} disabled={busy} aria-label={`장바구니 열기, ${count}개`}>
            <Icon name="cart" size={20} /><span className="header-cart-count">{count}</span>
            {count > 0 && <span className="header-cart-total">{quote.data ? formatMoney(quote.data.totals.totalCents) : quote.loading ? "계산 중..." : "견적 필요"}</span>}
          </button>
        </div>
      </header>

      <main className="main-content" id="main-content" ref={pageHeading} tabIndex={-1}>
        {config.error !== null && <ErrorState title="스토어 설정을 불러오지 못했습니다" error={config.error} onRetry={config.reload} />}
        {customerResource.error !== null && <ErrorState title="고객 목록을 불러오지 못했습니다" error={customerResource.error} onRetry={customerResource.reload} />}
        {customerResource.data?.items.length === 0 && <Notice tone="warning" title="등록된 고객이 없습니다">상품은 볼 수 있지만, 장바구니에 담거나 주문하려면 고객이 필요합니다.</Notice>}
        {draft.notice && <Notice tone={draft.notice.kind === "temporary" ? "info" : "warning"}
          title={draft.notice.kind === "corrupt" ? "저장된 장바구니 복구 필요" : draft.notice.kind === "temporary" ? "임시 장바구니" : "브라우저 저장소 확인 필요"}
          actions={<>
            {draft.notice.kind === "corrupt" && <button className="button button-small button-secondary" disabled={busy} onClick={draft.reset}>이 고객의 장바구니 초기화</button>}
            {draft.notice.kind !== "temporary" && <button className="button button-small button-secondary" disabled={busy} onClick={draft.retryStorage}>
              {draft.notice.kind === "unsaved" ? "다시 저장" : "다시 불러오기"}
            </button>}
            {draft.notice.kind === "unavailable" && <button className="text-button" disabled={busy} onClick={draft.useTemporary}>임시 장바구니 사용</button>}
          </>}>{draft.notice.message}</Notice>}
        {flash && <div className="flash-container"><Notice tone={flash.tone} actions={flash.cartLink && view !== "cart"
          ? <button className="text-button" disabled={busy} onClick={() => navigate("cart")}>장바구니 보기 <Icon name="arrow" size={15} /></button>
          : undefined}>{flash.message}</Notice>
          <button className="icon-button flash-dismiss" onClick={() => setFlash(null)} aria-label="알림 닫기"><Icon name="close" size={17} /></button>
        </div>}
        {view !== "cart" && quote.error !== null && draft.items.length > 0 && <Notice tone="warning" title="장바구니를 확인해 주세요"
          actions={<button className="text-button" disabled={busy} onClick={() => navigate("cart")}>장바구니 수정 <Icon name="arrow" size={15} /></button>}>
          {errorMessage(quote.error)} 장바구니는 그대로 보관했습니다.
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

        <footer className="page-footer"><span><strong>Marketlane</strong> / 일하는 하루를 위한 세심한 선택.</span><span>로컬 workspace &middot; USD 기준</span></footer>
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
