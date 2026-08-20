import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('src', { recursive: true });

const N = Number(process.argv[2] ?? 200);  // modules
const U = Number(process.argv[3] ?? 90);   // union members per module

writeFileSync('src/types.ts', `// type-level utilities (intentionally expensive to check)
export type Split<S extends string, D extends string> =
  string extends S ? string[] :
  S extends '' ? [] :
  S extends \`\${infer H}\${D}\${infer T}\` ? [H, ...Split<T, D>] : [S];

export type CamelCase<S extends string> =
  S extends \`\${infer H}_\${infer T}\` ? \`\${H}\${Capitalize<CamelCase<T>>}\` : S;

export type DeepPartial<T> = T extends (infer E)[] ? DeepPartial<E>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type DeepReadonly<T> = T extends (infer E)[] ? readonly DeepReadonly<E>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type Paths<T, D extends number = 5> = [D] extends [never] ? never
  : T extends object
    ? { [K in keyof T & string]: T[K] extends object ? K | \`\${K}.\${Paths<T[K], Prev[D]>}\` : K }[keyof T & string]
    : never;

export type PathValue<T, P extends string> =
  P extends \`\${infer K}.\${infer R}\` ? K extends keyof T ? PathValue<T[K], R> : never
  : P extends keyof T ? T[P] : never;

export type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
`);

const ids = [];
for (let i = 0; i < N; i++) {
  const names = Array.from({ length: U }, (_, j) => `entity_${i}_field_${j}`);
  const union = names.map((n) => `'${n}'`).join(' | ');
  const rec = names
    .slice(0, 40)
    .map((n) => `  ${n}: { id: number; label: string; nested: { deep: { value: \`${n}:\${string}\` } } };`)
    .join('\n');

  writeFileSync(
    `src/mod${i}.ts`,
    `import type { Split, CamelCase, DeepPartial, DeepReadonly, Paths, PathValue, UnionToIntersection } from './types.js';

export type Keys${i} = ${union};

export interface Model${i} {
${rec}
}

export type Camel${i} = { [K in Keys${i} as CamelCase<K>]: Split<K, '_'> };
export type Partial${i} = DeepPartial<Model${i}>;
export type Frozen${i} = DeepReadonly<Model${i}>;
export type AllPaths${i} = Paths<Model${i}>;
export type SomeValue${i} = PathValue<Model${i}, 'entity_${i}_field_0.nested.deep.value'>;
export type Merged${i} = UnionToIntersection<{ [K in Keys${i}]: { [P in K]: number } }[Keys${i}]>;

export function pick${i}<K extends keyof Model${i}>(m: Model${i}, keys: readonly K[]): Pick<Model${i}, K> {
  const out = {} as Pick<Model${i}, K>;
  for (const k of keys) out[k] = m[k];
  return out;
}

export function readPath${i}<P extends AllPaths${i}>(m: Model${i}, p: P): PathValue<Model${i}, P> {
  return p.split('.').reduce<unknown>((acc, seg) => (acc as Record<string, unknown>)[seg], m) as PathValue<Model${i}, P>;
}

export const sample${i}: Camel${i} = {} as Camel${i};
export const frozen${i}: Frozen${i} = {} as Frozen${i};
export const merged${i}: Merged${i} = {} as Merged${i};
export const partial${i}: Partial${i} = {};
`
  );
  ids.push(i);
}

writeFileSync(
  'src/index.ts',
  ids.map((i) => `export * from './mod${i}.js';`).join('\n') + `\nexport * from './lint-violations.js';\n`
);
console.log(`generated ${N} modules x ${U} union members (+ src/types.ts, src/index.ts)`);
