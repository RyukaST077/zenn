import { validateCents } from "./money";
export interface CartAmount { kind: "cart"; cents: number; }
export function cartAmount(cents: number): CartAmount {
  validateCents(cents);
  return { kind: "cart", cents };
}
