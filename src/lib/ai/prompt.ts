/** Instructions given to the AI to turn free text into an entry. */
import type { Category, FieldType } from "../types";
import { NO_CATEGORY } from "./entrySchema";

const UNIT_HINT: Record<FieldType, string> = {
  text: "texte",
  distance: "nombre en kilomètres",
  duration: "nombre en minutes",
  money: "nombre en euros",
  number: "nombre",
};

/** Local time with its UTC offset, e.g. `2026-11-25T18:04:00+01:00`. */
export function localIsoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

export function buildSystemPrompt(categories: Category[], now: Date = new Date()): string {
  const cats = categories
    .map((c) => {
      const fields = c.schema.fields.length
        ? c.schema.fields
            .map((f) => `${f.key} (${f.label}, ${f.type === "number" && f.unit ? `nombre de ${f.unit}` : UNIT_HINT[f.type]})`)
            .join(", ")
        : "aucun champ";
      return `- ${c.slug} : ${c.name}. Champs : ${fields}, note (texte libre)`;
    })
    .join("\n");

  return `Tu convertis une phrase en français en une entrée de journal d'habitudes.

Catégories disponibles :
${cats}

Règles :
- category : le slug de la catégorie qui correspond le mieux. Si la phrase ne décrit rien à enregistrer, réponds "${NO_CATEGORY}".
- fields : une liste de paires {key, value}. Utilise uniquement les clés de la catégorie choisie, ou "note".
- Pour les champs numériques, value contient seulement le nombre dans l'unité indiquée, sans unité (ex. "5", "28", "18.5"). Convertis si besoin : 1 h 20 → "80", 500 m → "0.5".
- N'invente aucune valeur absente de la phrase. Omets les champs inconnus.
- occurred_at : moment de l'activité en ISO 8601 avec fuseau, déduit de la phrase (« ce matin », « hier soir »…). Chaîne vide si la phrase ne donne aucun indice.
- Maintenant : ${localIsoWithOffset(now)}.

Réponds uniquement avec l'objet JSON.`;
}
