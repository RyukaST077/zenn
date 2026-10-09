export function parseCents(value: string): number {
  const cents = Math.floor(Number.parseFloat(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
  return cents;
}
