import { validateCents } from "./money";
export interface PaymentAmount { kind: "payment"; cents: number; }
export function paymentAmount(cents: number): PaymentAmount {
  validateCents(cents);
  return { kind: "payment", cents };
}
