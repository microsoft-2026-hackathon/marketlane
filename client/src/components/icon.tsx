import type { CSSProperties } from "react";

const paths = {
  shop: <><path d="m3 9 2-6h14l2 6M4 10v10h16V10M9 20v-7h6v7" /><path d="M3 9a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2" /></>,
  cart: <><path d="M3 3h2l3 12h10l3-9H6M8 15l-1 3h12" /><circle cx="9" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
  orders: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></>,
  inventory: <><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7 5l10 4" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="m12 3 10 18H2L12 3ZM12 9v5" /><path d="M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></>,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5ZM13 20h8" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  leaf: <><path d="M20 3C6 2 1 10 6 16s16 1 14-13ZM4 21l11-11" /></>,
  truck: <><path d="M2 5h12v12H2V5ZM14 9h4l4 5v3h-8" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  tag: <><path d="M3 3h8l10 10-8 8L3 11V3Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  money: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className = "", style }: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

export function BrandMark() {
  return <svg viewBox="0 0 40 40" width="38" height="38" fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="currentColor" />
    <path d="M9 29V12h5l6 9 6-9h5v17h-5v-9l-6 8-6-8v9H9Z" fill="#faf6e9" />
  </svg>;
}
