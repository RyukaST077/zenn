export interface CartAmount { kind: "cart"; cents: number; }
export function cartAmount(cents: number): CartAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "cart", cents };
}
