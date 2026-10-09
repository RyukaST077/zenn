import { validateCents } from "./money";
export interface InvoiceAmount { kind: "invoice"; cents: number; }
export function invoiceAmount(cents: number): InvoiceAmount {
  validateCents(cents);
  return { kind: "invoice", cents };
}
