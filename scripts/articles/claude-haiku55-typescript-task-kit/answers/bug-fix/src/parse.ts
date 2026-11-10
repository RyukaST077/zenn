export function parseCents(value: string): number {
  if (typeof value !== "string") throw new RangeError("amount");
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(value);
  if (!match || match[0] !== value) throw new RangeError("amount");
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("amount");
  return Number(cents);
}
