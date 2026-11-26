/**
 * Weekly review, pure part (tested): week bounds, numbers, Markdown, prompt.
 * Every number in the review is computed here; the AI only writes the text.
 */
import { addDays, toLocalDate } from "../dates";
import { formatDistance, formatDuration, formatMoney, formatEntryData } from "../format";
import { formatSeconds } from "../activity/timeline";
import type { Category, EntryData } from "../types";

export interface Week {
  /** ISO week id, e.g. `2026-W48`. */
  id: string;
  year: number;
  number: number;
  /** Monday and Sunday, local `YYYY-MM-DD`. */
  start: string;
  end: string;
}

/** ISO 8601 week containing `date` (weeks start on Monday). */
export function isoWeek(date: Date): Week {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayNum);
  // The ISO year is the year of the week's Thursday.
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7));
  const number = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  const start = toLocalDate(monday);
  return { id: `${year}-W${String(number).padStart(2, "0")}`, year, number, start, end: addDays(start, 6) };
}

export const previousWeek = (w: Week): Week => {
  const [y, m, d] = w.start.split("-").map(Number);
  return isoWeek(new Date(y, m - 1, d - 7));
};

/** `23 – 29 nov. 2026` */
export function weekLabel(w: Week): string {
  const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const a = parse(w.start), b = parse(w.end);
  const month = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" });
  const left = a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${month(a)}`;
  return `${left} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`;
}

/** File name of the review note: `bilan-2026-s48.md`. */
export const reviewFileName = (w: Week) => `bilan-${w.year}-s${String(w.number).padStart(2, "0")}.md`;

// ------------------------------------------------------------- numbers

export interface CategoryWeek {
  category: Category;
  count: number;
  days: number;
  /** Sums of numeric fields, already formatted: "Distance : 12,5 km". */
  totals: string[];
  /** Up to 6 entries, formatted. */
  examples: string[];
}

export interface WeekStats {
  week: Week;
  categories: CategoryWeek[];
  tasksDone: string[];
  tasksOpen: number;
  tasksOverdue: string[];
  activity: { totalSeconds: number; days: number; topApps: { app: string; seconds: number }[] } | null;
  streaks: { name: string; current: number }[];
}

export function summarizeCategories(
  entries: { categoryId: string; occurredAt: string; data: EntryData }[],
  categories: Category[],
): CategoryWeek[] {
  const out: CategoryWeek[] = [];
  for (const category of categories) {
    const mine = entries.filter((e) => e.categoryId === category.id);
    if (mine.length === 0) continue;
    const totals: string[] = [];
    for (const f of category.schema.fields) {
      if (f.type === "text") continue;
      const values = mine.map((e) => e.data[f.key]).filter((v): v is number => typeof v === "number");
      if (values.length === 0) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const text =
        f.type === "distance" ? formatDistance(sum)
        : f.type === "duration" ? formatDuration(Math.round(sum))
        : f.type === "money" ? formatMoney(sum)
        : `${Math.round(sum * 100) / 100}${f.unit ? ` ${f.unit}` : ""}`;
      totals.push(`${f.label} : ${text}`);
    }
    out.push({
      category,
      count: mine.length,
      days: new Set(mine.map((e) => toLocalDate(new Date(e.occurredAt)))).size,
      totals,
      examples: mine.slice(0, 6).map((e) => formatEntryData(category, e.data)),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ------------------------------------------------------------- Markdown

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Deterministic "numbers of the week" section. */
export function renderStatsMarkdown(s: WeekStats): string {
  const lines: string[] = ["## Chiffres de la semaine", ""];

  lines.push("### Habitudes", "");
  if (s.categories.length === 0) lines.push("Aucune entrée cette semaine.", "");
  for (const c of s.categories) {
    const head = `- **${c.category.icon ?? ""} ${c.category.name}** : ${plural(c.count, "entrée")} sur ${plural(c.days, "jour")}`;
    lines.push(c.totals.length ? `${head} · ${c.totals.join(" · ")}` : head);
  }
  if (s.streaks.length) {
    lines.push("", `Séries en cours : ${s.streaks.map((x) => `${x.name} ${x.current} j`).join(", ")}.`);
  }

  lines.push("", "### Tâches", "");
  lines.push(`- Faites : ${s.tasksDone.length}`);
  lines.push(`- Encore ouvertes : ${s.tasksOpen}`);
  if (s.tasksOverdue.length) lines.push(`- En retard : ${s.tasksOverdue.join(", ")}`);

  lines.push("", "### Ordinateur", "");
  if (!s.activity) {
    lines.push("ActivityWatch indisponible.");
  } else {
    const avg = s.activity.days ? s.activity.totalSeconds / s.activity.days : 0;
    lines.push(`Temps actif : ${formatSeconds(s.activity.totalSeconds)} (moyenne ${formatSeconds(avg)} par jour suivi).`, "");
    if (s.activity.topApps.length) {
      lines.push("| Application | Temps |", "|---|---|");
      for (const a of s.activity.topApps) lines.push(`| ${a.app.replace(/\|/g, "/")} | ${formatSeconds(a.seconds)} |`);
    }
  }
  return lines.join("\n");
}

export const REVIEW_SYSTEM_PROMPT = `Tu es un coach bienveillant, direct et concret. Tu écris le bilan hebdomadaire d'un étudiant à partir de ses données.

Format (Markdown, en français, 250 mots maximum) :
## En bref
2 ou 3 phrases.
## Points forts
2 à 4 puces.
## À améliorer
1 à 3 puces, sans culpabiliser.
## Pour la semaine prochaine
3 objectifs précis et mesurables, en cases à cocher (- [ ] …).

Règles :
- Utilise uniquement les chiffres fournis, tels quels. N'invente rien.
- « 3 entrées sur 2 jours » veut dire 3 au total dans la semaine, pas par jour : ne calcule pas de moyennes toi-même.
- Pas de titre de niveau 1, pas d'introduction ni de conclusion hors de ces sections.`;

export function reviewUserPrompt(s: WeekStats): string {
  const lines = [`Semaine ${s.week.number} (${weekLabel(s.week)}).`, "", renderStatsMarkdown(s)];
  const examples = s.categories.filter((c) => c.examples.length);
  if (examples.length) {
    lines.push("", "### Détail des entrées");
    for (const c of examples) lines.push(`- ${c.category.name} : ${c.examples.join(" ; ")}`);
  }
  if (s.tasksDone.length) lines.push("", `Tâches faites : ${s.tasksDone.slice(0, 15).join(" ; ")}`);
  return lines.join("\n");
}

/** Full note. `aiText` null when the AI was unavailable. */
export function renderReviewNote(s: WeekStats, aiText: string | null, generatedBy: string, now: Date): string {
  const when = now.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const body = aiText?.trim()
    ? aiText.trim().replace(/^#\s.*\n+/, "") // drop a level-1 title if the AI added one
    : "_Pas de texte IA : fournisseur indisponible. Relance `/bilan` plus tard._";
  return [
    `# Bilan semaine ${s.week.number} (${weekLabel(s.week)})`,
    "",
    `_Généré le ${when}${aiText ? ` par ${generatedBy}` : ""}. Les chiffres sont calculés par LifeOS, le texte par l'IA._`,
    "",
    body,
    "",
    "---",
    "",
    renderStatsMarkdown(s),
    "",
  ].join("\n");
}
