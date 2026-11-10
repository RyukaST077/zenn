export function validateCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
}
