import type { Overview } from "../../../shared/contracts.js";
import type { Resource } from "../hooks/use-resource.js";
import { formatMoney } from "../lib/money.js";
import { Icon, type IconName } from "./icon.js";
import { ErrorState } from "./ui.js";

export function OverviewStrip({ resource }: { resource: Resource<Overview> }) {
  const overview = resource.data;
  const stats: { label: string; value: string; hint: string; icon: IconName; attention?: boolean }[] = overview ? [
    { label: "Booked sales", value: formatMoney(overview.bookedSalesCents), hint: "All-time, including shipping", icon: "money" },
    { label: "Open orders", value: String(overview.openOrderCount), hint: "Placed or being packed", icon: "orders" },
    { label: "Low-stock products", value: String(overview.lowStockCount), hint: "At or below their threshold", icon: "inventory", attention: overview.lowStockCount > 0 },
    { label: "In the collection", value: String(overview.productCount), hint: "Goods for the working day", icon: "grid" },
  ] : [];
  return <section className="overview-section" aria-label="All-time operational summary">
    {resource.error !== null && <ErrorState title="The workspace summary is unavailable" error={resource.error} onRetry={resource.reload} />}
    {resource.loading && <div className="overview-grid" role="status" aria-label="Loading operational summary">
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
