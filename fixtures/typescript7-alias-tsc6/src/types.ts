// type-level utilities (intentionally expensive to check)
export type Split<S extends string, D extends string> =
  string extends S ? string[] :
  S extends '' ? [] :
  S extends `${infer H}${D}${infer T}` ? [H, ...Split<T, D>] : [S];

export type CamelCase<S extends string> =
  S extends `${infer H}_${infer T}` ? `${H}${Capitalize<CamelCase<T>>}` : S;

export type DeepPartial<T> = T extends (infer E)[] ? DeepPartial<E>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type DeepReadonly<T> = T extends (infer E)[] ? readonly DeepReadonly<E>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type Paths<T, D extends number = 5> = [D] extends [never] ? never
  : T extends object
    ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K], Prev[D]>}` : K }[keyof T & string]
    : never;

export type PathValue<T, P extends string> =
  P extends `${infer K}.${infer R}` ? K extends keyof T ? PathValue<T[K], R> : never
  : P extends keyof T ? T[P] : never;

export type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
