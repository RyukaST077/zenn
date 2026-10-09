import { validateCents } from "./money";
export interface QuoteAmount { kind: "quote"; cents: number; }
export function quoteAmount(cents: number): QuoteAmount {
  validateCents(cents);
  return { kind: "quote", cents };
}
