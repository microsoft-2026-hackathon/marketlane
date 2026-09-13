const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const MAX_PRODUCT_PRICE_CENTS = 10_000_000;
export const MAX_STOCK_ADJUSTMENT = 10_000;

export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Money must be a whole number of cents.");
  return usd.format(cents / 100);
}

export function parsePriceCents(input: string): number {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter a USD price with up to two decimal places, such as 24.50.");
  }
  const [dollars = "", fraction = ""] = value.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_PRODUCT_PRICE_CENTS) {
    throw new Error("Enter a price from $0.01 through $100,000.00.");
  }
  return cents;
}

export function priceInputValue(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid price.");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function parseStockDelta(input: string): number {
  const delta = stockDeltaFromInput(input);
  if (delta === null) throw new Error("Enter a nonzero whole number from -10,000 to 10,000, such as +12 or -3.");
  return delta;
}

export function stockDeltaFromInput(input: string): number | null {
  const value = input.trim();
  if (!/^[+-]?\d+$/.test(value)) return null;
  const delta = Number(value);
  return Number.isSafeInteger(delta) && delta !== 0 && Math.abs(delta) <= MAX_STOCK_ADJUSTMENT ? delta : null;
}
