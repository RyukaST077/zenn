export function discount(subtotal: number, percent: number, cap: number): number {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 1000000
      || !Number.isInteger(percent) || percent < 0 || percent > 100
      || !Number.isSafeInteger(cap) || cap < 0) throw new RangeError("discount");
  return Math.min(cap, Math.floor(subtotal * percent / 100));
}
