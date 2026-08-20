import type { Split, CamelCase, DeepPartial, DeepReadonly, Paths, PathValue, UnionToIntersection } from './types.js';

export type Keys1 = 'entity_1_field_0' | 'entity_1_field_1' | 'entity_1_field_2' | 'entity_1_field_3' | 'entity_1_field_4' | 'entity_1_field_5' | 'entity_1_field_6' | 'entity_1_field_7' | 'entity_1_field_8' | 'entity_1_field_9' | 'entity_1_field_10' | 'entity_1_field_11' | 'entity_1_field_12' | 'entity_1_field_13' | 'entity_1_field_14' | 'entity_1_field_15' | 'entity_1_field_16' | 'entity_1_field_17' | 'entity_1_field_18' | 'entity_1_field_19' | 'entity_1_field_20' | 'entity_1_field_21' | 'entity_1_field_22' | 'entity_1_field_23' | 'entity_1_field_24' | 'entity_1_field_25' | 'entity_1_field_26' | 'entity_1_field_27' | 'entity_1_field_28' | 'entity_1_field_29' | 'entity_1_field_30' | 'entity_1_field_31' | 'entity_1_field_32' | 'entity_1_field_33' | 'entity_1_field_34' | 'entity_1_field_35' | 'entity_1_field_36' | 'entity_1_field_37' | 'entity_1_field_38' | 'entity_1_field_39' | 'entity_1_field_40' | 'entity_1_field_41' | 'entity_1_field_42' | 'entity_1_field_43' | 'entity_1_field_44' | 'entity_1_field_45' | 'entity_1_field_46' | 'entity_1_field_47' | 'entity_1_field_48' | 'entity_1_field_49' | 'entity_1_field_50' | 'entity_1_field_51' | 'entity_1_field_52' | 'entity_1_field_53' | 'entity_1_field_54' | 'entity_1_field_55' | 'entity_1_field_56' | 'entity_1_field_57' | 'entity_1_field_58' | 'entity_1_field_59' | 'entity_1_field_60' | 'entity_1_field_61' | 'entity_1_field_62' | 'entity_1_field_63' | 'entity_1_field_64' | 'entity_1_field_65' | 'entity_1_field_66' | 'entity_1_field_67' | 'entity_1_field_68' | 'entity_1_field_69' | 'entity_1_field_70' | 'entity_1_field_71' | 'entity_1_field_72' | 'entity_1_field_73' | 'entity_1_field_74' | 'entity_1_field_75' | 'entity_1_field_76' | 'entity_1_field_77' | 'entity_1_field_78' | 'entity_1_field_79' | 'entity_1_field_80' | 'entity_1_field_81' | 'entity_1_field_82' | 'entity_1_field_83' | 'entity_1_field_84' | 'entity_1_field_85' | 'entity_1_field_86' | 'entity_1_field_87' | 'entity_1_field_88' | 'entity_1_field_89';

export interface Model1 {
  entity_1_field_0: { id: number; label: string; nested: { deep: { value: `entity_1_field_0:${string}` } } };
  entity_1_field_1: { id: number; label: string; nested: { deep: { value: `entity_1_field_1:${string}` } } };
  entity_1_field_2: { id: number; label: string; nested: { deep: { value: `entity_1_field_2:${string}` } } };
  entity_1_field_3: { id: number; label: string; nested: { deep: { value: `entity_1_field_3:${string}` } } };
  entity_1_field_4: { id: number; label: string; nested: { deep: { value: `entity_1_field_4:${string}` } } };
  entity_1_field_5: { id: number; label: string; nested: { deep: { value: `entity_1_field_5:${string}` } } };
  entity_1_field_6: { id: number; label: string; nested: { deep: { value: `entity_1_field_6:${string}` } } };
  entity_1_field_7: { id: number; label: string; nested: { deep: { value: `entity_1_field_7:${string}` } } };
  entity_1_field_8: { id: number; label: string; nested: { deep: { value: `entity_1_field_8:${string}` } } };
  entity_1_field_9: { id: number; label: string; nested: { deep: { value: `entity_1_field_9:${string}` } } };
  entity_1_field_10: { id: number; label: string; nested: { deep: { value: `entity_1_field_10:${string}` } } };
  entity_1_field_11: { id: number; label: string; nested: { deep: { value: `entity_1_field_11:${string}` } } };
  entity_1_field_12: { id: number; label: string; nested: { deep: { value: `entity_1_field_12:${string}` } } };
  entity_1_field_13: { id: number; label: string; nested: { deep: { value: `entity_1_field_13:${string}` } } };
  entity_1_field_14: { id: number; label: string; nested: { deep: { value: `entity_1_field_14:${string}` } } };
  entity_1_field_15: { id: number; label: string; nested: { deep: { value: `entity_1_field_15:${string}` } } };
  entity_1_field_16: { id: number; label: string; nested: { deep: { value: `entity_1_field_16:${string}` } } };
  entity_1_field_17: { id: number; label: string; nested: { deep: { value: `entity_1_field_17:${string}` } } };
  entity_1_field_18: { id: number; label: string; nested: { deep: { value: `entity_1_field_18:${string}` } } };
  entity_1_field_19: { id: number; label: string; nested: { deep: { value: `entity_1_field_19:${string}` } } };
  entity_1_field_20: { id: number; label: string; nested: { deep: { value: `entity_1_field_20:${string}` } } };
  entity_1_field_21: { id: number; label: string; nested: { deep: { value: `entity_1_field_21:${string}` } } };
  entity_1_field_22: { id: number; label: string; nested: { deep: { value: `entity_1_field_22:${string}` } } };
  entity_1_field_23: { id: number; label: string; nested: { deep: { value: `entity_1_field_23:${string}` } } };
  entity_1_field_24: { id: number; label: string; nested: { deep: { value: `entity_1_field_24:${string}` } } };
  entity_1_field_25: { id: number; label: string; nested: { deep: { value: `entity_1_field_25:${string}` } } };
  entity_1_field_26: { id: number; label: string; nested: { deep: { value: `entity_1_field_26:${string}` } } };
  entity_1_field_27: { id: number; label: string; nested: { deep: { value: `entity_1_field_27:${string}` } } };
  entity_1_field_28: { id: number; label: string; nested: { deep: { value: `entity_1_field_28:${string}` } } };
  entity_1_field_29: { id: number; label: string; nested: { deep: { value: `entity_1_field_29:${string}` } } };
  entity_1_field_30: { id: number; label: string; nested: { deep: { value: `entity_1_field_30:${string}` } } };
  entity_1_field_31: { id: number; label: string; nested: { deep: { value: `entity_1_field_31:${string}` } } };
  entity_1_field_32: { id: number; label: string; nested: { deep: { value: `entity_1_field_32:${string}` } } };
  entity_1_field_33: { id: number; label: string; nested: { deep: { value: `entity_1_field_33:${string}` } } };
  entity_1_field_34: { id: number; label: string; nested: { deep: { value: `entity_1_field_34:${string}` } } };
  entity_1_field_35: { id: number; label: string; nested: { deep: { value: `entity_1_field_35:${string}` } } };
  entity_1_field_36: { id: number; label: string; nested: { deep: { value: `entity_1_field_36:${string}` } } };
  entity_1_field_37: { id: number; label: string; nested: { deep: { value: `entity_1_field_37:${string}` } } };
  entity_1_field_38: { id: number; label: string; nested: { deep: { value: `entity_1_field_38:${string}` } } };
  entity_1_field_39: { id: number; label: string; nested: { deep: { value: `entity_1_field_39:${string}` } } };
}

export type Camel1 = { [K in Keys1 as CamelCase<K>]: Split<K, '_'> };
export type Partial1 = DeepPartial<Model1>;
export type Frozen1 = DeepReadonly<Model1>;
export type AllPaths1 = Paths<Model1>;
export type SomeValue1 = PathValue<Model1, 'entity_1_field_0.nested.deep.value'>;
export type Merged1 = UnionToIntersection<{ [K in Keys1]: { [P in K]: number } }[Keys1]>;

export function pick1<K extends keyof Model1>(m: Model1, keys: readonly K[]): Pick<Model1, K> {
  const out = {} as Pick<Model1, K>;
  for (const k of keys) out[k] = m[k];
  return out;
}

export function readPath1<P extends AllPaths1>(m: Model1, p: P): PathValue<Model1, P> {
  return p.split('.').reduce<unknown>((acc, seg) => (acc as Record<string, unknown>)[seg], m) as PathValue<Model1, P>;
}

export const sample1: Camel1 = {} as Camel1;
export const frozen1: Frozen1 = {} as Frozen1;
export const merged1: Merged1 = {} as Merged1;
export const partial1: Partial1 = {};
