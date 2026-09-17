import type { Product, QuoteLine, StoreConfig, Totals } from "../../shared/contracts.js";
import { AppError } from "../domain/errors.js";

export const storeConfig: StoreConfig = {
  storeName: "Marketlane",
  currency: "USD",
  shippingFeeCents: 590,
  freeShippingThresholdCents: 10_000,
  supportedLocales: ["en", "ko"],
};

export interface Coupon {
  code: string;
  percent: number;
  minSubtotalCents: number;
}

export function priceCart(
  items: readonly { product: Product; quantity: number }[],
  coupon: Coupon | null,
): { items: QuoteLine[]; totals: Totals } {
  if (!items.length) throw new AppError(400, "EMPTY_CART", "상품을 하나 이상 담아 주세요.");
  const subtotalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  if (coupon && subtotalCents < coupon.minSubtotalCents) {
    throw new AppError(422, "COUPON_MINIMUM", "쿠폰의 최소 상품 금액 조건을 충족하지 않습니다.", {
      minimumCents: coupon.minSubtotalCents,
    });
  }
  const lines = items.map(({ product, quantity }): QuoteLine => {
    const lineSubtotalCents = product.priceCents * quantity;
    const discountCents = coupon ? Math.floor(lineSubtotalCents * coupon.percent / 100) : 0;
    return {
      productId: product.id, sku: product.sku, name: product.name, category: product.category,
      quantity, unitPriceCents: product.priceCents, lineSubtotalCents,
      discountCents, lineTotalCents: lineSubtotalCents - discountCents,
      stockOnHand: product.stockOnHand,
    };
  });
  const discountCents = lines.reduce((sum, item) => sum + item.discountCents, 0);
  const netMerchandise = subtotalCents - discountCents;
  const shippingCents = netMerchandise >= storeConfig.freeShippingThresholdCents ? 0 : storeConfig.shippingFeeCents;
  return {
    items: lines,
    totals: { subtotalCents, discountCents, shippingCents, totalCents: netMerchandise + shippingCents },
  };
}
