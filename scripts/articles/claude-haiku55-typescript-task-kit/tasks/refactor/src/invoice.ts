export interface InvoiceAmount { kind: "invoice"; cents: number; }
export function invoiceAmount(cents: number): InvoiceAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "invoice", cents };
}
