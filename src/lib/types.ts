/** Domain types shared by parsing, DB and UI. */

/** How a field value is read from the user input. */
export type FieldType = "text" | "distance" | "duration" | "money" | "number";

export interface FieldDef {
  /** Key in the entry `data` JSON, e.g. `distance_km`. */
  key: string;
  /** Label shown in the UI, e.g. "Distance". */
  label: string;
  type: FieldType;
  /** Text fields only: take one word, or all remaining words. */
  take?: "word" | "rest";
  /** Number fields only: unit written after the value, e.g. `pages` in `30pages`. */
  unit?: string;
}

export interface CategorySchema {
  fields: FieldDef[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  schema: CategorySchema;
  isSystem: boolean;
}

/** Values stored in `entries.data`. Numbers are in the field's base unit (km, min, €). */
export type EntryData = Record<string, string | number>;

export type EntrySource = "manual" | "ai" | "activitywatch" | "github";

export interface Entry {
  id: string;
  categoryId: string;
  occurredAt: string;
  data: EntryData;
  source: EntrySource;
}
