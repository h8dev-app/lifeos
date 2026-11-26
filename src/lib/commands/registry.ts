/**
 * Command catalogue for autocompletion and /help (pure, tested).
 * Built-in commands + one command per habit category (from its fields).
 */
import type { Category, FieldDef } from "../types";
import { slugify } from "../parsing/slash";

export interface ParamDef {
  /** How it is written: `@date`, `#catégorie`, `<titre>`… */
  token: string;
  desc: string;
  /** Prefix that triggers suggestions for this param (`@`, `#`, `!`, `*`). */
  prefix?: string;
}

export interface CommandDef {
  name: string;
  aliases?: string[];
  group: "Saisir" | "Organiser" | "Outils";
  summary: string;
  syntax: string;
  params: ParamDef[];
  examples: string[];
  /** Can be run without arguments (Enter on the bare command submits). */
  bare?: boolean;
  icon?: string;
}

const DATE: ParamDef = { token: "@date", prefix: "@", desc: "@auj, @demain, @après-demain, @lundi…@dimanche, @28/11, @28/11/2026" };

export const BUILTIN_COMMANDS: CommandDef[] = [
  {
    name: "tache", aliases: ["tâche", "todo"], group: "Organiser", icon: "✅",
    summary: "Ajouter une tâche au kanban",
    syntax: "/tache <titre> [#catégorie] [!priorité] [@échéance]",
    params: [
      { token: "<titre>", desc: "ce qu'il faut faire" },
      { token: "#catégorie", prefix: "#", desc: "catégorie de tâche (créée si besoin, _ = espace)" },
      { token: "!priorité", prefix: "!", desc: "!haute, !moyenne, !basse" },
      { ...DATE, token: "@échéance" },
    ],
    examples: ["/tache rendre le dossier #Cours !haute @vendredi", "/tache faire les courses"],
  },
  {
    name: "rdv", group: "Organiser", icon: "📅",
    summary: "Ajouter un rendez-vous à l'agenda",
    syntax: "/rdv <titre> [@date] <heure | 9h-10h30> [*lieu]",
    params: [
      { token: "<titre>", desc: "nom du rendez-vous" },
      DATE,
      { token: "<heure>", desc: "14h30, 9h, 14:30 ou une plage 9h-10h30 (1 h par défaut)" },
      { token: "*lieu", prefix: "*", desc: "lieu (_ = espace), optionnel" },
    ],
    examples: ["/rdv Dentiste @demain 14h30 *Cabinet_Dupont", "/rdv Réunion projet @lundi 9h-10h30"],
  },
  {
    name: "memo", aliases: ["mémo", "pensebete"], group: "Organiser", icon: "📌",
    summary: "Ajouter un pense-bête (rappel à 9 h ou à l'heure donnée)",
    syntax: "/memo <texte> [@date] [heure]",
    params: [{ token: "<texte>", desc: "ce qu'il ne faut pas oublier" }, DATE, { token: "[heure]", desc: "18h, 9h30… (sinon toute la journée)" }],
    examples: ["/memo payer le loyer @vendredi", "/memo appeler maman 18h"],
  },
  {
    name: "note", group: "Organiser", icon: "📝", bare: true,
    summary: "Créer une note (ou ouvrir les notes sans argument)",
    syntax: "/note [titre] [#catégorie]",
    params: [{ token: "[titre]", desc: "titre de la note" }, { token: "#catégorie", prefix: "#", desc: "catégorie de notes (dossier)" }],
    examples: ["/note Révisions réseau #Cours", "/note"],
  },
  {
    name: "cat", group: "Saisir", icon: "🗂", bare: false,
    summary: "Créer une catégorie d'habitude",
    syntax: "/cat <nom> [icône] [champ:type …]",
    params: [
      { token: "<nom>", desc: "nom de la catégorie (devient la commande /nom)" },
      { token: "[icône]", desc: "un emoji" },
      { token: "champ:type", desc: "types : texte, distance, durée, euros, nombre" },
    ],
    examples: ["/cat lecture 📖 livre:texte pages:nombre durée:durée"],
  },
  {
    name: "bilan", group: "Outils", icon: "📊", bare: true,
    summary: "Bilan IA de la semaine (enregistré dans Notes)",
    syntax: "/bilan [-1]",
    params: [{ token: "[-1]", desc: "-1 = semaine dernière (sinon semaine en cours)" }],
    examples: ["/bilan", "/bilan -1"],
  },
  {
    name: "claude", group: "Outils", icon: "🤖", bare: true,
    summary: "Ouvrir Claude Code dans un terminal",
    syntax: "/claude [dossier]",
    params: [{ token: "[dossier]", desc: "dossier de travail (~/projets par défaut)" }],
    examples: ["/claude ~/projets/lifeos"],
  },
  {
    name: "help", aliases: ["aide"], group: "Outils", icon: "❓", bare: true,
    summary: "Afficher l'aide des commandes",
    syntax: "/help [commande]",
    params: [{ token: "[commande]", desc: "détail d'une commande, ex. /help tache" }],
    examples: ["/help", "/help rdv"],
  },
];

const FIELD_HINT: Record<FieldDef["type"], string> = {
  text: "texte",
  distance: "5km, 500m",
  duration: "28min, 1h20",
  money: "18€, 18,50€",
  number: "nombre",
};

/** `/sport [activité] [distance] [durée]` from the category fields. */
export function categoryCommand(c: Category): CommandDef {
  const fields = c.schema.fields;
  const params: ParamDef[] = fields.map((f) => ({
    token: `[${f.label.toLowerCase()}]`,
    desc: f.type === "number" && f.unit ? `ex. 30${f.unit}` : f.type === "text" ? (f.take === "word" ? "un mot" : "texte") : `ex. ${FIELD_HINT[f.type]}`,
  }));
  if (!fields.some((f) => f.key === "note")) params.push({ token: "[note]", desc: "le reste du texte" });
  const sample = fields
    .map((f) => (f.type === "text" ? "…" : f.type === "number" && f.unit ? `3${f.unit}` : FIELD_HINT[f.type].split(",")[0]))
    .join(" ");
  return {
    name: c.slug,
    group: "Saisir",
    icon: c.icon ?? "•",
    summary: `Saisie ${c.name.toLowerCase()} (habitude)`,
    syntax: `/${c.slug} ${params.map((p) => p.token).join(" ")}`,
    params,
    examples: c.slug === "sport" ? ["/sport course 5km 28min"]
      : c.slug === "commande" ? ["/commande ubereats 18,50€"]
      : c.slug === "devoirs" ? ["/devoirs maths 45min exercices p.12"]
      : c.slug === "cuisine" ? ["/cuisine pâtes carbo"]
      : [`/${c.slug} ${sample}`.trim()],
  };
}

export function allCommands(categories: Category[]): CommandDef[] {
  return [...categories.filter((c) => !c.isSystem).map(categoryCommand), ...BUILTIN_COMMANDS];
}

const norm = (s: string) => slugify(s);

/** Commands whose name/alias starts with the query first, then those containing it. */
export function matchCommands(query: string, commands: CommandDef[]): CommandDef[] {
  const q = norm(query);
  if (!q) return commands;
  const names = (c: CommandDef) => [c.name, ...(c.aliases ?? [])].map(norm);
  const starts = commands.filter((c) => names(c).some((n) => n.startsWith(q)));
  // Inside the name, or (3+ letters) in the description: "/agenda" finds /rdv.
  const contains = commands.filter((c) => !starts.includes(c)
    && (names(c).some((n) => n.includes(q)) || (q.length >= 3 && norm(c.summary).includes(q))));
  return [...starts, ...contains];
}

export function findCommand(name: string, commands: CommandDef[]): CommandDef | undefined {
  const n = norm(name);
  return commands.find((c) => norm(c.name) === n || (c.aliases ?? []).some((a) => norm(a) === n));
}

// ------------------------------------------------------------- input context

export type InputContext =
  | { kind: "none" }
  | { kind: "command"; query: string }
  | { kind: "params"; command: string; token: string; tokenStart: number };

/** Where the cursor is: typing the command name, or a parameter (last word). */
export function inputContext(input: string): InputContext {
  if (!input.startsWith("/")) return { kind: "none" };
  const space = input.search(/\s/);
  if (space === -1) return { kind: "command", query: input.slice(1) };
  const command = input.slice(1, space);
  const lastSpace = Math.max(input.lastIndexOf(" "), input.lastIndexOf("\t"));
  return { kind: "params", command, token: input.slice(lastSpace + 1), tokenStart: lastSpace + 1 };
}

/** Replace the word being typed (`tokenStart` → end) by `text` and add a space. */
export function applyToken(input: string, tokenStart: number, text: string): string {
  return `${input.slice(0, tokenStart)}${text} `;
}

export interface Suggestion {
  insert: string;
  label: string;
  hint?: string;
}

const DATE_WORDS: Suggestion[] = [
  { insert: "@auj", label: "@auj", hint: "aujourd'hui" },
  { insert: "@demain", label: "@demain" },
  { insert: "@après-demain", label: "@après-demain" },
  ...["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"].map((d) => ({ insert: `@${d}`, label: `@${d}`, hint: "le prochain" })),
];

const PRIORITY_WORDS: Suggestion[] = [
  { insert: "!haute", label: "!haute", hint: "🔴" },
  { insert: "!moyenne", label: "!moyenne", hint: "🟠" },
  { insert: "!basse", label: "!basse", hint: "⚪" },
];

/** Suggestions for the word being typed (`@`, `#`, `!`). */
export function tokenSuggestions(
  command: CommandDef | undefined,
  token: string,
  data: { taskCategories: string[]; noteFolders: string[] },
): Suggestion[] {
  if (!command || !token) return [];
  const prefix = token[0];
  if (!command.params.some((p) => p.prefix === prefix)) return [];
  const typed = norm(token.slice(1));
  const keep = (list: Suggestion[]) => list.filter((s) => norm(s.insert.slice(1)).startsWith(typed) && s.insert !== token);
  if (prefix === "@") return keep(DATE_WORDS);
  if (prefix === "!") return keep(PRIORITY_WORDS);
  if (prefix === "#") {
    const names = command.name === "note" ? data.noteFolders : data.taskCategories;
    return keep(names.map((n) => ({ insert: `#${n.replace(/ /g, "_")}`, label: `#${n}` })));
  }
  return [];
}
