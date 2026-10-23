export interface PaymentAmount { kind: "payment"; cents: number; }
export function paymentAmount(cents: number): PaymentAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "payment", cents };
}
