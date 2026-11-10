import { validateCents } from "./money";
export interface LedgerAmount { kind: "ledger"; cents: number; }
export function ledgerAmount(cents: number): LedgerAmount {
  validateCents(cents);
  return { kind: "ledger", cents };
}
