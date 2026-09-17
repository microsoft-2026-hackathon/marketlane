import type { Database } from "../db/database.js";
import { AppError } from "../domain/errors.js";
import type { Coupon } from "./pricing.js";

interface CouponRow {
  code: string;
  percent: number;
  min_subtotal_cents: number;
  active: number;
}

export function findCoupon(database: Database, code?: string): Coupon | null {
  if (!code) return null;
  const row = database.prepare<[string], CouponRow>(
    "SELECT code, percent, min_subtotal_cents, active FROM coupons WHERE code = ?",
  ).get(code.trim().toUpperCase());
  if (!row || row.active !== 1) {
    throw new AppError(422, "COUPON_UNAVAILABLE", "등록되지 않았거나 비활성화된 쿠폰입니다.");
  }
  return { code: row.code, percent: row.percent, minSubtotalCents: row.min_subtotal_cents };
}
