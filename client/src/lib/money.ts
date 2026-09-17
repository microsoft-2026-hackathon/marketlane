const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const MAX_PRODUCT_PRICE_CENTS = 10_000_000;
export const MAX_STOCK_ADJUSTMENT = 10_000;

export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("금액은 정수 cents여야 합니다.");
  return usd.format(cents / 100);
}

export function parsePriceCents(input: string): number {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("USD 가격을 소수점 둘째 자리까지 입력해 주세요. 예: 24.50");
  }
  const [dollars = "", fraction = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_PRODUCT_PRICE_CENTS) {
    throw new Error("$0.01~$100,000.00 사이의 가격을 입력해 주세요.");
  }
  return cents;
}

export function priceInputValue(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("가격이 올바르지 않습니다.");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function parseStockDelta(input: string): number {
  const delta = stockDeltaFromInput(input);
  if (delta === null) throw new Error("-10,000~10,000 사이에서 0이 아닌 정수를 입력해 주세요. 예: +12 또는 -3");
  return delta;
}

export function stockDeltaFromInput(input: string): number | null {
  const value = input.trim();
  if (!/^[+-]?\d+$/.test(value)) return null;
  const delta = Number(value);
  return Number.isSafeInteger(delta) && delta !== 0 && Math.abs(delta) <= MAX_STOCK_ADJUSTMENT ? delta : null;
}
