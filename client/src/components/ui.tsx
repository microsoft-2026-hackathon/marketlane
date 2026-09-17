import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Category, OrderStatus, Product, Totals } from "../../../shared/contracts.js";
import { errorMessage } from "../api.js";
import { formatMoney } from "../lib/money.js";
import { Icon, type IconName } from "./icon.js";

export const categoryLabels: Record<Category, string> = { desk: "Desk", carry: "Carry", paper: "Paper" };
export const statusLabels: Record<OrderStatus, string> = { placed: "주문 접수", packing: "포장 중", shipped: "발송 완료" };

export function Notice({ children, title, tone = "info", actions }: {
  children: ReactNode;
  title?: string;
  tone?: "info" | "success" | "warning" | "error";
  actions?: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" || tone === "warning" ? "alert" : "status"}>
      <Icon name={tone === "success" ? "check" : tone === "error" || tone === "warning" ? "alert" : "info"} />
      <div className="notice-content">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
        {actions && <div className="notice-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Loading({ label = "불러오는 중..." }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ error, onRetry, title = "확인이 필요합니다" }: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  return <Notice tone="error" title={title} actions={
    <button className="button button-small button-secondary" onClick={onRetry}><Icon name="refresh" size={16} />다시 시도</button>
  }>{errorMessage(error)}</Notice>;
}

export function EmptyState({ icon = "inventory", title, children, action }: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return <div className="empty-state">
    <span className="empty-icon"><Icon name={icon} size={30} /></span>
    <h3>{title}</h3>
    <p>{children}</p>
    {action}
  </div>;
}

export function StockBadge({ product }: { product: Product }) {
  if (product.stockOnHand === 0) return <span className="stock-badge stock-out"><span />품절</span>;
  if (product.stockOnHand <= product.lowStockThreshold) {
    return <span className="stock-badge stock-low"><span />{product.stockOnHand}개 남음</span>;
  }
  return <span className="stock-badge"><span />재고 있음</span>;
}

export function LanguageBadge({ product }: { product: Product }) {
  return product.locale !== product.contentLocale
    ? <span className="language-badge" title="한국어 번역이 없어 영어로 표시합니다.">English fallback</span>
    : null;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-${status}`}><span />{statusLabels[status]}</span>;
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

export function Timestamp({ value, withTime = false }: { value: string; withTime?: boolean }) {
  const date = new Date(value);
  return <time dateTime={value} title={dateTimeFormatter.format(date)}>
    {(withTime ? dateTimeFormatter : dateFormatter).format(date)}
  </time>;
}

export function TotalsBreakdown({ totals, couponCode }: { totals: Totals; couponCode?: string | null }) {
  return <dl className="totals">
    <div><dt>상품 금액</dt><dd>{formatMoney(totals.subtotalCents)}</dd></div>
    {totals.discountCents > 0 && <div className="total-discount">
      <dt>할인{couponCode && <small>{couponCode}</small>}</dt>
      <dd>-{formatMoney(totals.discountCents)}</dd>
    </div>}
    <div><dt>배송비</dt><dd>{totals.shippingCents === 0 ? "무료" : formatMoney(totals.shippingCents)}</dd></div>
    <div className="total-final"><dt>합계 <span>USD</span></dt><dd>{formatMoney(totals.totalCents)}</dd></div>
  </dl>;
}

export function Modal({ title, eyebrow, children, onClose, busy = false, wide = false }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className={`modal ${wide ? "modal-wide" : ""}`} aria-labelledby={titleId}
      aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="modal-heading">
        <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div>
        <button className="icon-button" onClick={onClose} disabled={busy} aria-label="대화상자 닫기"><Icon name="close" /></button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
