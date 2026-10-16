export interface LedgerAmount { kind: "ledger"; cents: number; }
export function ledgerAmount(cents: number): LedgerAmount {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return { kind: "ledger", cents };
}
