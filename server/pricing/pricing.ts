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
  if (!items.length) throw new AppError(400, "EMPTY_CART", "Add at least one product.");
  const subtotalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  if (coupon && subtotalCents < coupon.minSubtotalCents) {
    throw new AppError(422, "COUPON_MINIMUM", "This cart does not meet the coupon minimum.", {
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
