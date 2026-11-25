/**
 * What the AI must answer for a free-text entry, and how we check it.
 *
 * The answer uses a fixed shape (fields as key/value strings) so the same
 * strict JSON schema works for Ollama, Anthropic and OpenAI, whatever the
 * category. Values are then converted with the same unit parsers as the
 * slash commands, and anything unexpected is dropped or moved to `note`.
 */
import { z } from "zod";
import type { Category, EntryData, FieldDef } from "../types";
import { parseDistance, parseDuration, parseMoney, parseNumber } from "../parsing/units";

/** Category slug the AI uses when the text is not something to log. */
export const NO_CATEGORY = "aucune";

/** JSON schema sent to the providers (strict mode: every object closed). */
export function buildResponseSchema(categories: Category[]) {
  return {
    type: "object",
    properties: {
      category: { type: "string", enum: [...categories.map((c) => c.slug), NO_CATEGORY] },
      occurred_at: { type: "string" },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: { key: { type: "string" }, value: { type: "string" } },
          required: ["key", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["category", "occurred_at", "fields"],
    additionalProperties: false,
  };
}

const answerSchema = z.object({
  category: z.string(),
  occurred_at: z.string().default(""),
  fields: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number()]) })).default([]),
});

export type AiEntryResult =
  | { kind: "entry"; category: Category; data: EntryData; occurredAt: string }
  | { kind: "none" }
  | { kind: "error"; message: string };

/** Some models wrap JSON in ``` fences or add text around it. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("pas de JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const num = (v: string) => {
  const n = Number(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/** Value string → stored value, or null if it does not fit the field type. */
function convert(field: FieldDef, value: string): string | number | null {
  const v = value.trim();
  if (!v) return null;
  switch (field.type) {
    case "text": return v;
    case "distance": return parseDistance(v.replace(/\s/g, "")) ?? num(v);
    case "duration": return parseDuration(v.replace(/\s/g, "")) ?? num(v);
    case "money": return parseMoney(v.replace(/\s/g, "")) ?? num(v);
    case "number": return parseNumber(v.replace(/\s/g, ""), field.unit) ?? num(v);
  }
}

/** ISO date from the AI, kept only if valid, not in the future, at most 30 days old. */
function checkDate(value: string, now: Date): string {
  const d = new Date(value);
  const t = d.getTime();
  if (!value || Number.isNaN(t)) return now.toISOString();
  if (t > now.getTime() + 5 * 60_000 || t < now.getTime() - 30 * 86_400_000) return now.toISOString();
  return d.toISOString();
}

export function validateAiEntry(raw: string, categories: Category[], now: Date = new Date()): AiEntryResult {
  let parsed;
  try {
    parsed = answerSchema.safeParse(extractJson(raw));
  } catch {
    return { kind: "error", message: "Réponse de l'IA illisible (JSON invalide)." };
  }
  if (!parsed.success) return { kind: "error", message: "Réponse de l'IA au mauvais format." };

  const answer = parsed.data;
  if (answer.category === NO_CATEGORY) return { kind: "none" };
  const category = categories.find((c) => c.slug === answer.category);
  if (!category) return { kind: "error", message: `Catégorie « ${answer.category} » inconnue.` };

  const data: EntryData = {};
  const extra: string[] = [];
  for (const { key, value } of answer.fields) {
    const field = category.schema.fields.find((f) => f.key === key);
    const text = String(value);
    if (!field) {
      if (text.trim()) extra.push(key === "note" ? text.trim() : `${key}: ${text.trim()}`);
      continue;
    }
    if (key in data) continue;
    const converted = convert(field, text);
    if (converted !== null) data[key] = converted;
    else if (text.trim()) extra.push(`${field.label}: ${text.trim()}`);
  }
  if (extra.length) data.note = [data.note, ...extra].filter(Boolean).join(" · ");

  if (Object.keys(data).length === 0) return { kind: "error", message: "L'IA n'a trouvé aucune valeur à enregistrer." };
  return { kind: "entry", category, data, occurredAt: checkDate(answer.occurred_at, now) };
}
