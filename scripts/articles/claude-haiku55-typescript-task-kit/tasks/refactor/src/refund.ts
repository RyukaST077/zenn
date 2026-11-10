export interface RefundAmount { kind: "refund"; cents: number; }
export function refundAmount(cents: number): RefundAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "refund", cents };
}
