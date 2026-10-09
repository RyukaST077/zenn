import { validateCents } from "./money";
export interface RefundAmount { kind: "refund"; cents: number; }
export function refundAmount(cents: number): RefundAmount {
  validateCents(cents);
  return { kind: "refund", cents };
}
