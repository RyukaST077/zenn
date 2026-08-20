import type { Split, CamelCase, DeepPartial, DeepReadonly, Paths, PathValue, UnionToIntersection } from './types.js';

export type Keys0 = 'entity_0_field_0' | 'entity_0_field_1' | 'entity_0_field_2' | 'entity_0_field_3' | 'entity_0_field_4' | 'entity_0_field_5' | 'entity_0_field_6' | 'entity_0_field_7' | 'entity_0_field_8' | 'entity_0_field_9' | 'entity_0_field_10' | 'entity_0_field_11' | 'entity_0_field_12' | 'entity_0_field_13' | 'entity_0_field_14' | 'entity_0_field_15' | 'entity_0_field_16' | 'entity_0_field_17' | 'entity_0_field_18' | 'entity_0_field_19' | 'entity_0_field_20' | 'entity_0_field_21' | 'entity_0_field_22' | 'entity_0_field_23' | 'entity_0_field_24' | 'entity_0_field_25' | 'entity_0_field_26' | 'entity_0_field_27' | 'entity_0_field_28' | 'entity_0_field_29' | 'entity_0_field_30' | 'entity_0_field_31' | 'entity_0_field_32' | 'entity_0_field_33' | 'entity_0_field_34' | 'entity_0_field_35' | 'entity_0_field_36' | 'entity_0_field_37' | 'entity_0_field_38' | 'entity_0_field_39' | 'entity_0_field_40' | 'entity_0_field_41' | 'entity_0_field_42' | 'entity_0_field_43' | 'entity_0_field_44' | 'entity_0_field_45' | 'entity_0_field_46' | 'entity_0_field_47' | 'entity_0_field_48' | 'entity_0_field_49' | 'entity_0_field_50' | 'entity_0_field_51' | 'entity_0_field_52' | 'entity_0_field_53' | 'entity_0_field_54' | 'entity_0_field_55' | 'entity_0_field_56' | 'entity_0_field_57' | 'entity_0_field_58' | 'entity_0_field_59' | 'entity_0_field_60' | 'entity_0_field_61' | 'entity_0_field_62' | 'entity_0_field_63' | 'entity_0_field_64' | 'entity_0_field_65' | 'entity_0_field_66' | 'entity_0_field_67' | 'entity_0_field_68' | 'entity_0_field_69' | 'entity_0_field_70' | 'entity_0_field_71' | 'entity_0_field_72' | 'entity_0_field_73' | 'entity_0_field_74' | 'entity_0_field_75' | 'entity_0_field_76' | 'entity_0_field_77' | 'entity_0_field_78' | 'entity_0_field_79' | 'entity_0_field_80' | 'entity_0_field_81' | 'entity_0_field_82' | 'entity_0_field_83' | 'entity_0_field_84' | 'entity_0_field_85' | 'entity_0_field_86' | 'entity_0_field_87' | 'entity_0_field_88' | 'entity_0_field_89';

export interface Model0 {
  entity_0_field_0: { id: number; label: string; nested: { deep: { value: `entity_0_field_0:${string}` } } };
  entity_0_field_1: { id: number; label: string; nested: { deep: { value: `entity_0_field_1:${string}` } } };
  entity_0_field_2: { id: number; label: string; nested: { deep: { value: `entity_0_field_2:${string}` } } };
  entity_0_field_3: { id: number; label: string; nested: { deep: { value: `entity_0_field_3:${string}` } } };
  entity_0_field_4: { id: number; label: string; nested: { deep: { value: `entity_0_field_4:${string}` } } };
  entity_0_field_5: { id: number; label: string; nested: { deep: { value: `entity_0_field_5:${string}` } } };
  entity_0_field_6: { id: number; label: string; nested: { deep: { value: `entity_0_field_6:${string}` } } };
  entity_0_field_7: { id: number; label: string; nested: { deep: { value: `entity_0_field_7:${string}` } } };
  entity_0_field_8: { id: number; label: string; nested: { deep: { value: `entity_0_field_8:${string}` } } };
  entity_0_field_9: { id: number; label: string; nested: { deep: { value: `entity_0_field_9:${string}` } } };
  entity_0_field_10: { id: number; label: string; nested: { deep: { value: `entity_0_field_10:${string}` } } };
  entity_0_field_11: { id: number; label: string; nested: { deep: { value: `entity_0_field_11:${string}` } } };
  entity_0_field_12: { id: number; label: string; nested: { deep: { value: `entity_0_field_12:${string}` } } };
  entity_0_field_13: { id: number; label: string; nested: { deep: { value: `entity_0_field_13:${string}` } } };
  entity_0_field_14: { id: number; label: string; nested: { deep: { value: `entity_0_field_14:${string}` } } };
  entity_0_field_15: { id: number; label: string; nested: { deep: { value: `entity_0_field_15:${string}` } } };
  entity_0_field_16: { id: number; label: string; nested: { deep: { value: `entity_0_field_16:${string}` } } };
  entity_0_field_17: { id: number; label: string; nested: { deep: { value: `entity_0_field_17:${string}` } } };
  entity_0_field_18: { id: number; label: string; nested: { deep: { value: `entity_0_field_18:${string}` } } };
  entity_0_field_19: { id: number; label: string; nested: { deep: { value: `entity_0_field_19:${string}` } } };
  entity_0_field_20: { id: number; label: string; nested: { deep: { value: `entity_0_field_20:${string}` } } };
  entity_0_field_21: { id: number; label: string; nested: { deep: { value: `entity_0_field_21:${string}` } } };
  entity_0_field_22: { id: number; label: string; nested: { deep: { value: `entity_0_field_22:${string}` } } };
  entity_0_field_23: { id: number; label: string; nested: { deep: { value: `entity_0_field_23:${string}` } } };
  entity_0_field_24: { id: number; label: string; nested: { deep: { value: `entity_0_field_24:${string}` } } };
  entity_0_field_25: { id: number; label: string; nested: { deep: { value: `entity_0_field_25:${string}` } } };
  entity_0_field_26: { id: number; label: string; nested: { deep: { value: `entity_0_field_26:${string}` } } };
  entity_0_field_27: { id: number; label: string; nested: { deep: { value: `entity_0_field_27:${string}` } } };
  entity_0_field_28: { id: number; label: string; nested: { deep: { value: `entity_0_field_28:${string}` } } };
  entity_0_field_29: { id: number; label: string; nested: { deep: { value: `entity_0_field_29:${string}` } } };
  entity_0_field_30: { id: number; label: string; nested: { deep: { value: `entity_0_field_30:${string}` } } };
  entity_0_field_31: { id: number; label: string; nested: { deep: { value: `entity_0_field_31:${string}` } } };
  entity_0_field_32: { id: number; label: string; nested: { deep: { value: `entity_0_field_32:${string}` } } };
  entity_0_field_33: { id: number; label: string; nested: { deep: { value: `entity_0_field_33:${string}` } } };
  entity_0_field_34: { id: number; label: string; nested: { deep: { value: `entity_0_field_34:${string}` } } };
  entity_0_field_35: { id: number; label: string; nested: { deep: { value: `entity_0_field_35:${string}` } } };
  entity_0_field_36: { id: number; label: string; nested: { deep: { value: `entity_0_field_36:${string}` } } };
  entity_0_field_37: { id: number; label: string; nested: { deep: { value: `entity_0_field_37:${string}` } } };
  entity_0_field_38: { id: number; label: string; nested: { deep: { value: `entity_0_field_38:${string}` } } };
  entity_0_field_39: { id: number; label: string; nested: { deep: { value: `entity_0_field_39:${string}` } } };
}

export type Camel0 = { [K in Keys0 as CamelCase<K>]: Split<K, '_'> };
export type Partial0 = DeepPartial<Model0>;
export type Frozen0 = DeepReadonly<Model0>;
export type AllPaths0 = Paths<Model0>;
export type SomeValue0 = PathValue<Model0, 'entity_0_field_0.nested.deep.value'>;
export type Merged0 = UnionToIntersection<{ [K in Keys0]: { [P in K]: number } }[Keys0]>;

export function pick0<K extends keyof Model0>(m: Model0, keys: readonly K[]): Pick<Model0, K> {
  const out = {} as Pick<Model0, K>;
  for (const k of keys) out[k] = m[k];
  return out;
}

export function readPath0<P extends AllPaths0>(m: Model0, p: P): PathValue<Model0, P> {
  return p.split('.').reduce<unknown>((acc, seg) => (acc as Record<string, unknown>)[seg], m) as PathValue<Model0, P>;
}

export const sample0: Camel0 = {} as Camel0;
export const frozen0: Frozen0 = {} as Frozen0;
export const merged0: Merged0 = {} as Merged0;
export const partial0: Partial0 = {};
