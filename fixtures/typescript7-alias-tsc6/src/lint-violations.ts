// 意図的な型情報つきルール違反（eslint の検出件数を構成A/Cで比較するための固定値）
export async function fetchAll(): Promise<void> {
  Promise.resolve(1); // @typescript-eslint/no-floating-promises
}

export function loose(x: any): string {
  return x.toString(); // @typescript-eslint/no-unsafe-* 系
}

export function stringify(v: unknown): string {
  return `value: ${v}`; // @typescript-eslint/restrict-template-expressions
}
