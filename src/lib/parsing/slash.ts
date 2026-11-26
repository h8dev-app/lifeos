/**
 * Deterministic parsing of the command bar (no AI, instant).
 *
 *   /sport course 5km 28min        → entry in "sport"
 *   /tache, /note, /claude, /cat   → built-in commands
 *   text without "/"               → free text, sent to the AI (milestone 4)
 *
 * Generic rule, driven by the category `fields_schema`:
 *   1. tokens with a unit (5km, 28min, 18€…) fill the matching unit fields,
 *      in schema order; `18 €` (number + unit) also works;
 *   2. the remaining words fill the text fields: `take: "word"` takes one word,
 *      `take: "rest"` takes all the remaining words;
 *   3. words left over go to `note`.
 */
import type { Category, EntryData, FieldDef, FieldType } from "../types";
import { isBareNumber, parseDistance, parseDuration, parseMoney, parseNumber } from "./units";

export const BUILTINS = ["tache", "note", "claude", "cat", "bilan"] as const;
export type Builtin = (typeof BUILTINS)[number];

export type ParseResult =
  | { kind: "entry"; category: Category; data: EntryData }
  | { kind: "builtin"; command: Builtin; args: string }
  | { kind: "freetext"; text: string }
  | { kind: "error"; message: string };

/** Lowercase, no accents, only [a-z0-9-]. `Tâche` → `tache`. */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findCategory(command: string, categories: Category[]): Category | undefined {
  const slug = slugify(command);
  return (
    categories.find((c) => c.slug === slug) ??
    // Tolerate singular/plural: /commandes → commande, /devoir → devoirs.
    categories.find((c) => c.slug === slug.replace(/s$/, "") || c.slug === `${slug}s`)
  );
}

export function parseInput(input: string, categories: Category[]): ParseResult {
  const text = input.trim();
  if (!text) return { kind: "error", message: "Rien à enregistrer." };
  if (!text.startsWith("/")) return { kind: "freetext", text };

  const [head, ...rest] = text.slice(1).split(/\s+/);
  const command = slugify(head);
  const args = rest.join(" ");
  if (!command) return { kind: "error", message: "Commande vide après « / »." };

  if ((BUILTINS as readonly string[]).includes(command)) {
    return { kind: "builtin", command: command as Builtin, args };
  }

  const category = findCategory(command, categories);
  if (!category) {
    return {
      kind: "error",
      message: `Catégorie « ${head} » inconnue. Crée-la avec /cat ${head}`,
    };
  }
  const data = parseFields(rest, category.schema.fields);
  if (Object.keys(data).length === 0) {
    return { kind: "error", message: `Rien à enregistrer pour ${category.name}.` };
  }
  return { kind: "entry", category, data };
}

const UNIT_PARSERS: Record<Exclude<FieldType, "text">, (tok: string, f: FieldDef) => number | null> = {
  distance: (t) => parseDistance(t),
  duration: (t) => parseDuration(t),
  money: (t) => parseMoney(t),
  number: (t, f) => parseNumber(t, f.unit),
};

/** Try every free unit field on one token; return the field that accepted it. */
function matchUnit(token: string, free: FieldDef[], data: EntryData): FieldDef | undefined {
  for (const field of free) {
    if (field.type === "text") continue;
    const value = UNIT_PARSERS[field.type](token, field);
    if (value !== null) {
      data[field.key] = value;
      return field;
    }
  }
  return undefined;
}

export function parseFields(tokens: string[], fields: FieldDef[]): EntryData {
  const data: EntryData = {};
  const free = fields.filter((f) => f.type !== "text");
  const words: string[] = [];

  // Step 1: unit values.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let used = matchUnit(token, free, data);
    // "18 €" / "28 min": bare number followed by its unit.
    if (!used && isBareNumber(token) && i + 1 < tokens.length) {
      used = matchUnit(token + tokens[i + 1], free, data);
      if (used) i++;
    }
    if (used) free.splice(free.indexOf(used), 1);
    else words.push(token);
  }

  // Step 2: text fields, in schema order.
  for (const field of fields) {
    if (field.type !== "text" || words.length === 0) continue;
    const value = field.take === "word" ? words.shift()! : words.splice(0).join(" ");
    data[field.key] = value;
  }

  // Step 3: leftovers.
  if (words.length > 0) {
    const note = words.join(" ");
    data.note = typeof data.note === "string" ? `${data.note} ${note}` : note;
  }
  return data;
}

// ---------------------------------------------------------------- /cat

/** French type names accepted in `/cat` → field type. */
const CAT_TYPES: Record<string, FieldType> = {
  texte: "text",
  distance: "distance",
  duree: "duration",
  temps: "duration",
  euros: "money",
  euro: "money",
  prix: "money",
  montant: "money",
  nombre: "number",
};

export interface NewCategory {
  slug: string;
  name: string;
  icon: string | null;
  fields: FieldDef[];
}

export const CAT_USAGE =
  "Usage : /cat <nom> [icône] [champ:type …] — types : texte, distance, durée, euros, nombre. " +
  "Ex. /cat lecture 📖 livre:texte pages:nombre durée:durée";

/**
 * `/cat lecture 📖 livre:texte pages:nombre durée:durée`
 * - `nombre` fields use their name as unit: `/lecture 30pages`.
 * - Text fields take one word each, the last one takes the rest.
 */
export function parseCatArgs(args: string): NewCategory | { error: string } {
  const [rawName, ...rest] = args.trim().split(/\s+/).filter(Boolean);
  if (!rawName) return { error: CAT_USAGE };

  const slug = slugify(rawName);
  if (!slug) return { error: `Nom invalide : « ${rawName} ».` };
  if ((BUILTINS as readonly string[]).includes(slug)) {
    return { error: `« ${slug} » est une commande intégrée, choisis un autre nom.` };
  }

  let icon: string | null = null;
  const fields: FieldDef[] = [];
  for (const token of rest) {
    const sep = token.indexOf(":");
    if (sep === -1) {
      // A token with no letter/digit is the icon (emoji).
      if (!icon && !/[\p{L}\p{N}]/u.test(token)) {
        icon = token;
        continue;
      }
      return { error: `« ${token} » : écris champ:type. ${CAT_USAGE}` };
    }
    const label = token.slice(0, sep);
    const typeName = slugify(token.slice(sep + 1));
    const type = CAT_TYPES[typeName];
    const key = slugify(label).replace(/-/g, "_");
    if (!key || !/^[a-z]/.test(key)) return { error: `Nom de champ invalide : « ${label} ».` };
    if (!type) return { error: `Type « ${token.slice(sep + 1)} » inconnu. ${CAT_USAGE}` };
    if (fields.some((f) => f.key === key)) return { error: `Champ « ${label} » en double.` };
    const field: FieldDef = { key, label: capitalize(label), type };
    if (type === "number") field.unit = key;
    fields.push(field);
  }

  const texts = fields.filter((f) => f.type === "text");
  texts.forEach((f, i) => (f.take = i === texts.length - 1 ? "rest" : "word"));

  return { slug, name: capitalize(rawName), icon, fields };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
