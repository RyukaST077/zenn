export interface QuoteAmount { kind: "quote"; cents: number; }
export function quoteAmount(cents: number): QuoteAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "quote", cents };
}
