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
      <div><p className="eyebrow">선반에서 고객의 책상까지</p><h1>주문</h1><p>접수부터 발송까지 주문을 확인하세요.</p></div>
      <button className="button button-secondary" onClick={resource.reload} disabled={busy || resource.loading}><Icon name="refresh" size={17} />주문 새로고침</button>
    </div>
    <div className="operations-note"><Icon name="info" size={17} />주문은 접수 기록이며 결제 영수증이 아닙니다. 주문 접수, 포장 중, 발송 완료 순으로 처리합니다.</div>
    <section className="panel orders-panel" aria-labelledby="order-list-title">
      <div className="panel-heading">
        <div><h2 id="order-list-title">주문 목록</h2><p className="muted small">필터에 맞는 최근 주문 100건입니다.</p></div>
        <label className="inline-select">고객
          <select value={customerId} onChange={(event) => onCustomerChange(event.target.value)} disabled={busy}>
            <option value="">전체 고객</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
      </div>
      <div className="orders-toolbar">
        <div className="segmented-control" aria-label="주문 상태">
          {(["", "placed", "packing", "shipped"] as const).map((value) => <button key={value}
            className={value === status ? "selected" : ""} aria-pressed={value === status} disabled={busy}
            onClick={() => setStatus(value)}>{value ? statusLabels[value] : "전체 주문"}</button>)}
        </div>
        <span className="muted small" aria-live="polite">{resource.data ? `${resource.data.items.length}건 표시` : ""}</span>
      </div>
      {resource.loading && <Loading label="주문 불러오는 중..." />}
      {resource.error !== null && <div className="panel-inset"><ErrorState error={resource.error} onRetry={resource.reload} /></div>}
      {resource.data?.items.length === 0 && <EmptyState icon="orders" title="표시할 주문이 없습니다"
        action={(status || customerId) ? <button className="button button-secondary" onClick={() => { setStatus(""); onCustomerChange(""); }}>필터 초기화</button> : undefined}>
        {status || customerId ? "다른 상태나 고객을 선택해 주세요." : "주문이 접수되면 여기에 표시됩니다."}
      </EmptyState>}
      {resource.data && resource.data.items.length > 0 && <div className="table-scroll" role="region" aria-label="주문 목록" tabIndex={0}>
        <table className="data-table orders-table">
          <thead><tr><th scope="col">주문</th><th scope="col">고객</th><th scope="col">상태</th><th scope="col">접수 시각</th><th scope="col" className="align-right">합계</th><th scope="col"><span className="sr-only">상세</span></th></tr></thead>
          <tbody>{resource.data.items.map((order) => <tr key={order.id}>
            <td><button className="table-link" onClick={() => onOpen(order.id)} disabled={busy}>{order.number}</button><span className="cell-secondary">총 {itemCount(order.items)}개</span></td>
            <td><strong className="cell-name">{order.customer.name}</strong><span className="cell-secondary">{order.customer.company}</span></td>
            <td><StatusBadge status={order.status} /></td>
            <td className="date-cell"><Timestamp value={order.createdAt} withTime /></td>
            <td className="align-right money-cell">{formatMoney(order.totals.totalCents)}</td>
            <td><button className="icon-button" onClick={() => onOpen(order.id)} disabled={busy} aria-label={`주문 ${order.number} 보기`}><Icon name="arrow" size={18} /></button></td>
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
      setError("주문을 다시 불러온 뒤 상태를 변경해 주세요.");
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

  return <Modal title={order?.number ?? "주문 상세"} eyebrow="주문 기록" onClose={onClose} busy={busy} wide>
    {resource.loading && <Loading label="주문 기록 불러오는 중..." />}
    {resource.error !== null && <ErrorState error={resource.error} onRetry={resource.reload} />}
    {order && <>
      <div className="order-detail-header">
        <div><StatusBadge status={order.status} /><span className="muted small">접수 <Timestamp value={order.createdAt} withTime /></span></div>
        <strong className="order-detail-total">{formatMoney(order.totals.totalCents)} <span>USD</span></strong>
      </div>
      <ol className="fulfillment-timeline" aria-label="주문 처리 진행 상황">
        {([
          { status: "placed", time: order.createdAt, icon: "check" },
          { status: "packing", time: order.packedAt, icon: "inventory" },
          { status: "shipped", time: order.shippedAt, icon: "truck" },
        ] as const).map((step) => <li key={step.status} className={step.time ? "step-complete" : ""}
          aria-current={order.status === step.status ? "step" : undefined}>
          <span className="step-icon"><Icon name={step.icon} size={19} /></span>
          <strong>{statusLabels[step.status]}</strong><span>{step.time ? <Timestamp value={step.time} withTime /> : "대기 중"}</span>
        </li>)}
      </ol>

      <div className="order-snapshot-meta">
        <div><span className="eyebrow">주문 당시 고객 정보</span><strong>{order.customer.name}</strong>
          <span>{order.customer.company}</span><span>{order.customer.email}</span></div>
        <div><span className="eyebrow">주문 정보</span><span>총 {itemCount(order.items)}개 / {order.items.length}종</span>
          <span>상품 정보 언어: {order.locale === "ko" ? "한국어" : "English"}</span><span>{order.couponCode ? `쿠폰: ${order.couponCode}` : "쿠폰 사용 안 함"}</span></div>
      </div>
      <div className="snapshot-label"><Icon name="clock" size={16} /><span>주문 시점의 snapshot입니다. 이후 상품이나 고객을 수정해도 이 기록은 바뀌지 않습니다.</span></div>
      <div className="table-scroll" role="region" aria-label="주문 상품 snapshot" tabIndex={0}>
        <table className="data-table order-lines-table">
          <thead><tr><th scope="col">상품</th><th scope="col" className="align-right">수량</th><th scope="col" className="align-right">단가</th><th scope="col" className="align-right">할인</th><th scope="col" className="align-right">상품별 합계</th></tr></thead>
          <tbody>{order.items.map((line) => <tr key={line.productId}>
            <td><strong className="cell-name">{line.name}</strong><span className="cell-secondary">{line.sku} / {categoryLabels[line.category]}</span></td>
            <td className="align-right">{line.quantity}</td><td className="align-right">{formatMoney(line.unitPriceCents)}</td>
            <td className="align-right">{line.discountCents > 0 ? `-${formatMoney(line.discountCents)}` : formatMoney(0)}</td>
            <td className="align-right money-cell">{formatMoney(line.lineTotalCents)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="order-detail-bottom">
        <div className="order-snapshot-note"><span className="eyebrow">주문 메모</span>
          <p>{order.note || "작성된 메모가 없습니다."}</p></div>
        <div><TotalsBreakdown totals={order.totals} couponCode={order.couponCode} /></div>
      </div>

      <section className="fulfillment-actions" aria-labelledby="fulfillment-actions-title">
        <div><h3 id="fulfillment-actions-title">{order.status === "shipped" ? "주문 처리 완료" : "다음 단계"}</h3>
          <p className="small muted">{order.status === "placed" ? "고객에게 보낼 상품의 포장을 시작하세요."
            : order.status === "packing" ? "상품을 실제로 발송한 뒤 발송 완료로 변경해 주세요."
            : "발송 완료된 주문입니다. 더 이상 상태를 변경할 수 없습니다."}</p></div>
        {!confirmTarget && order.status !== "shipped" && <button className="button button-primary" disabled={busy}
          onClick={() => { setError(null); setConfirmTarget(order.status === "placed" ? "packing" : "shipped"); }}>
          <Icon name={order.status === "placed" ? "inventory" : "truck"} size={18} />{order.status === "placed" ? "포장 시작" : "발송 완료 처리"}
        </button>}
        {confirmTarget && <Notice tone="warning" title={confirmTarget === "packing" ? "포장을 시작할까요?" : "실제 발송을 완료했나요?"}
          actions={<>
            <button className="button button-small button-secondary" disabled={busy} onClick={() => setConfirmTarget(null)}>아직 아님</button>
            <button className="button button-small button-primary" disabled={busy} onClick={() => { void advance(); }}>
              {busy ? <><span className="spinner" />변경 중...</> : confirmTarget === "packing" ? "포장 확인" : "발송 확인"}
            </button>
          </>}>
          상태 변경은 되돌릴 수 없습니다. 재고는 주문 접수 시 차감했으며 다시 차감하지 않습니다.
        </Notice>}
        {error && <Notice tone="error" title="상태를 변경하지 못했습니다" actions={
          <button className="text-button" disabled={busy} onClick={() => { setError(null); setConfirmTarget(null); resource.reload(); }}>주문 다시 불러오기</button>
        }>{error}</Notice>}
      </section>
    </>}
  </Modal>;
}
