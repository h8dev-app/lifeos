/** Human-readable display of entry values (French). */
import type { Category, EntryData, FieldDef } from "./types";

const fr = (n: number, digits = 2) =>
  n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${fr(km)} km`;
}

export function formatMoney(eur: number): string {
  return eur.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatValue(field: FieldDef | undefined, value: string | number): string {
  if (typeof value === "string" || !field) return String(value);
  switch (field.type) {
    case "duration": return formatDuration(value);
    case "distance": return formatDistance(value);
    case "money": return formatMoney(value);
    case "number": return field.unit ? `${fr(value)} ${field.unit}` : fr(value);
    default: return String(value);
  }
}

/** `{activity:"course", distance_km:5, duration_min:28}` → `course · 5 km · 28 min`. */
export function formatEntryData(category: Category, data: EntryData): string {
  const fields = category.schema.fields;
  // Schema order first, then unknown keys (e.g. `note`).
  const keys = [
    ...fields.map((f) => f.key).filter((k) => k in data),
    ...Object.keys(data).filter((k) => !fields.some((f) => f.key === k)),
  ];
  return keys
    .map((k) => formatValue(fields.find((f) => f.key === k), data[k]))
    .join(" · ");
}
