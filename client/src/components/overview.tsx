import type { Overview } from "../../../shared/contracts.js";
import type { Resource } from "../hooks/use-resource.js";
import { formatMoney } from "../lib/money.js";
import { Icon, type IconName } from "./icon.js";
import { ErrorState } from "./ui.js";

export function OverviewStrip({ resource }: { resource: Resource<Overview> }) {
  const overview = resource.data;
  const stats: { label: string; value: string; hint: string; icon: IconName; attention?: boolean }[] = overview ? [
    { label: "누적 주문 매출", value: formatMoney(overview.bookedSalesCents), hint: "전체 기간 · 배송비 포함", icon: "money" },
    { label: "진행 중인 주문", value: String(overview.openOrderCount), hint: "접수 또는 포장 중", icon: "orders" },
    { label: "재고 부족 상품", value: String(overview.lowStockCount), hint: "부족 기준 이하", icon: "inventory", attention: overview.lowStockCount > 0 },
    { label: "등록 상품", value: String(overview.productCount), hint: "일하는 하루를 위한 물건", icon: "grid" },
  ] : [];
  return <section className="overview-section" aria-label="전체 기간 운영 요약">
    {resource.error !== null && <ErrorState title="운영 요약을 불러오지 못했습니다" error={resource.error} onRetry={resource.reload} />}
    {resource.loading && <div className="overview-grid" role="status" aria-label="운영 요약 불러오는 중">
      {Array.from({ length: 4 }, (_, index) => <div className="overview-stat" key={index}><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-stat" /></div>)}
    </div>}
    {overview && <div className="overview-grid">
      {stats.map((stat) => <div className={`overview-stat ${stat.attention ? "stat-attention" : ""}`} key={stat.label}>
        <div className="stat-topline"><span>{stat.label}</span><Icon name={stat.icon} size={17} /></div>
        <strong>{stat.value}</strong><span className="stat-hint">{stat.hint}</span>
      </div>)}
    </div>}
  </section>;
}
