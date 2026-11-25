/**
 * `categories.fields_schema` JSON format, validated with zod.
 *
 * Example (sport):
 * {"fields":[
 *   {"key":"activity","label":"Activité","type":"text","take":"rest"},
 *   {"key":"distance_km","label":"Distance","type":"distance"},
 *   {"key":"duration_min","label":"Durée","type":"duration"}
 * ]}
 */
import { z } from "zod";
import type { CategorySchema } from "../types";

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "distance", "duration", "money", "number"]),
  take: z.enum(["word", "rest"]).optional(),
  unit: z.string().min(1).optional(),
});

export const categorySchema = z.object({ fields: z.array(fieldSchema) });

/** Parse the stored JSON. Invalid or empty → no fields (everything goes to `note`). */
export function parseFieldsSchema(json: string | null): CategorySchema {
  if (!json) return { fields: [] };
  try {
    const result = categorySchema.safeParse(JSON.parse(json));
    return result.success ? result.data : { fields: [] };
  } catch {
    return { fields: [] };
  }
}
