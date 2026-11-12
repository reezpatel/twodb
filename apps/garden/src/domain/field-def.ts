import type { Field, FieldConfig, FieldType, SystemFieldId, ValueType } from "../shared/model.js";
import { FIELD_TYPE_LABELS, valueTypeOf } from "../shared/model.js";

/** Internal field definition (user field rows + virtual system fields). */
export interface FieldDef {
  id: string;
  databaseId: string;
  name: string;
  type: FieldType;
  config: FieldConfig;
  position: number;
  system: boolean;
}

/** databaseId → its fields (incl. system fields). Preloaded so compilation stays synchronous. */
export type FieldCatalog = Map<string, FieldDef[]>;

const SYSTEM_DEFS: { id: SystemFieldId; position: number }[] = [
  { id: "title", position: -1000 },
  { id: "created_time", position: 100000 },
  { id: "updated_time", position: 100001 },
  { id: "created_by", position: 100002 },
];

export function systemFields(databaseId: string): FieldDef[] {
  return SYSTEM_DEFS.map((s) => ({
    id: s.id,
    databaseId,
    name: s.id === "title" ? "Name" : FIELD_TYPE_LABELS[s.id],
    type: s.id,
    config: {},
    position: s.position,
    system: true,
  }));
}

export function toFieldDto(f: FieldDef, valueType?: ValueType, error?: string | null): Field {
  return {
    id: f.id,
    databaseId: f.databaseId,
    name: f.name,
    type: f.type,
    config: f.config,
    position: f.position,
    system: f.system,
    valueType: valueType ?? valueTypeOf(f.type),
    ...(error ? { error } : {}),
  };
}
