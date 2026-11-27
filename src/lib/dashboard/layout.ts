/**
 * Home screen: blocks placed freely. Each block has a type (what it shows),
 * an optional title chosen by the user, and options (filters, project,
 * note…). Several blocks of the same type are allowed.
 * Position/size are fractions of the home area (0..1), so the layout
 * follows the window size. Overlap is allowed; array order is the stacking
 * order (last = on top). Pure logic, saved as JSON in the settings store.
 */
import type { IconName } from "../ui/iconNames";

export type BlockType =
  | "clock" | "agenda" | "tasks" | "project" | "projects" | "notes" | "note" | "memo"
  | "streaks" | "entries" | "activity" | "stats";

export type BlockOptions = Record<string, string | boolean>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Block extends Rect {
  id: string;
  type: BlockType;
  /** Title chosen by the user; null = the type's name. */
  title: string | null;
  options: BlockOptions;
}

/** Minimum size of a block, in fractions of the home area (computed from pixels by the view). */
export interface MinSize {
  w: number;
  h: number;
}

export interface BlockTypeDef {
  label: string;
  /** One sentence shown in the "Ajouter un bloc" list. */
  desc: string;
  icon: IconName;
  /** Minimum size in pixels. */
  minW: number;
  minH: number;
  /** Size when added (fractions). */
  size: { w: number; h: number };
  defaults: BlockOptions;
}

export const BLOCK_TYPES: Record<BlockType, BlockTypeDef> = {
  clock: {
    label: "Horloge", desc: "L'heure et la date du jour, en grand.", icon: "alarm-clock",
    minW: 160, minH: 90, size: { w: 0.25, h: 0.22 }, defaults: { seconds: false },
  },
  agenda: {
    label: "Agenda", desc: "Rendez-vous et pense-bêtes : aujourd'hui, 3 jours ou la semaine.", icon: "calendar",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.45 }, defaults: { range: "today" },
  },
  tasks: {
    label: "Tâches", desc: "Une liste de tâches filtrée : du jour, toutes, en retard ; par projet ou catégorie.", icon: "list-checks",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.45 }, defaults: { scope: "today", project: "", category: "" },
  },
  project: {
    label: "Projet", desc: "Un projet : avancement, jalon suivant, prochaines tâches.", icon: "briefcase",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.35 }, defaults: { project: "" },
  },
  projects: {
    label: "Projets en cours", desc: "Tous les projets actifs et leur avancement.", icon: "flag",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.35 }, defaults: {},
  },
  notes: {
    label: "Notes récentes", desc: "Les dernières notes modifiées, d'un dossier ou de tous.", icon: "notebook-pen",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.35 }, defaults: { folder: "" },
  },
  note: {
    label: "Note épinglée", desc: "Le contenu d'une note, toujours sous les yeux.", icon: "file-text",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.45 }, defaults: { note: "" },
  },
  memo: {
    label: "Post-it", desc: "Un texte libre que tu écris directement dans le bloc.", icon: "pin",
    minW: 160, minH: 90, size: { w: 0.25, h: 0.3 }, defaults: { text: "" },
  },
  streaks: {
    label: "Séries d'habitudes", desc: "Nombre de jours d'affilée par habitude (sport, devoirs…).", icon: "flame",
    minW: 200, minH: 80, size: { w: 0.4, h: 0.2 }, defaults: {},
  },
  entries: {
    label: "Journal des habitudes", desc: "Tes dernières saisies (/sport, /cuisine…), d'une habitude ou de toutes.", icon: "book-open",
    minW: 240, minH: 120, size: { w: 0.32, h: 0.35 }, defaults: { category: "" },
  },
  stats: {
    label: "Statistiques", desc: "Tâches faites, saisies et temps d'écran sur 7 ou 30 jours, comparés à la période d'avant.",
    icon: "chart-column", minW: 240, minH: 160, size: { w: 0.34, h: 0.5 }, defaults: { period: "week" },
  },
  activity: {
    label: "Temps d'écran", desc: "Les applis les plus utilisées aujourd'hui (ActivityWatch).", icon: "activity",
    minW: 220, minH: 120, size: { w: 0.3, h: 0.35 }, defaults: {},
  },
};

export const BLOCK_TYPE_IDS = Object.keys(BLOCK_TYPES) as BlockType[];

export const isBlockType = (v: unknown): v is BlockType => typeof v === "string" && v in BLOCK_TYPES;

/** Title shown for a block: the user's, else the type's name. */
export const blockTitle = (b: Pick<Block, "type" | "title">) => b.title?.trim() || BLOCK_TYPES[b.type].label;

const block = (id: string, type: BlockType, x: number, y: number, w: number, h: number, options: BlockOptions = {}): Block => ({
  id, type, title: null, options: { ...BLOCK_TYPES[type].defaults, ...options }, x, y, w, h,
});

/** First layout. Ids of these blocks are their type (older versions, pinned widgets). */
export const DEFAULT_LAYOUT: Block[] = [
  block("clock", "clock", 0, 0, 0.32, 0.24),
  block("streaks", "streaks", 0.34, 0, 0.66, 0.24),
  block("agenda", "agenda", 0, 0.27, 0.32, 0.73),
  block("tasks", "tasks", 0.34, 0.27, 0.32, 0.73),
  block("entries", "entries", 0.68, 0.27, 0.32, 0.355),
  block("activity", "activity", 0.68, 0.645, 0.32, 0.355),
];

export const defaultLayout = (): Block[] => DEFAULT_LAYOUT.map((b) => ({ ...b, options: { ...b.options } }));

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Keep a rectangle inside the area and above its minimum size. */
export function clampRect<T extends Rect>(r: T, min: MinSize = { w: 0, h: 0 }): T {
  const w = clamp(r.w, Math.min(min.w, 1), 1);
  const h = clamp(r.h, Math.min(min.h, 1), 1);
  return { ...r, x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}

export type Handle = "move" | "e" | "s" | "se";

/** Apply a pointer delta (fractions) to the rectangle the drag started from. */
export function dragRect<T extends Rect>(start: T, handle: Handle, dx: number, dy: number, min: MinSize): T {
  if (handle === "move") return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, min);
  const w = handle === "s" ? start.w : clamp(start.w + dx, min.w, 1 - start.x);
  const h = handle === "e" ? start.h : clamp(start.h + dy, min.h, 1 - start.y);
  return { ...start, w, h };
}

/**
 * Magnetic alignment: edges closer than `threshold` to an edge of the area
 * or of another block stick to it. Moves keep the size; resizes move only
 * the dragged edges.
 */
export function snapRect<T extends Rect & { id: string }>(r: T, others: (Rect & { id: string })[], handle: Handle, threshold: number): T {
  const xs = [0, 1];
  const ys = [0, 1];
  for (const o of others) {
    if (o.id === r.id) continue;
    xs.push(o.x, o.x + o.w);
    ys.push(o.y, o.y + o.h);
  }
  const nearest = (v: number, lines: number[]) => {
    let best: number | null = null;
    for (const l of lines) if (Math.abs(l - v) <= threshold && (best === null || Math.abs(l - v) < Math.abs(best - v))) best = l;
    return best;
  };
  const out = { ...r };
  if (handle === "move") {
    const left = nearest(r.x, xs);
    const right = nearest(r.x + r.w, xs);
    if (left !== null && (right === null || Math.abs(left - r.x) <= Math.abs(right - r.x - r.w))) out.x = left;
    else if (right !== null) out.x = right - r.w;
    const top = nearest(r.y, ys);
    const bottom = nearest(r.y + r.h, ys);
    if (top !== null && (bottom === null || Math.abs(top - r.y) <= Math.abs(bottom - r.y - r.h))) out.y = top;
    else if (bottom !== null) out.y = bottom - r.h;
    return out;
  }
  if (handle !== "s") {
    const right = nearest(r.x + r.w, xs);
    if (right !== null && right > r.x) out.w = right - r.x;
  }
  if (handle !== "e") {
    const bottom = nearest(r.y + r.h, ys);
    if (bottom !== null && bottom > r.y) out.h = bottom - r.y;
  }
  return out;
}

/** Replace one block and put it on top. */
export function updateBlock(layout: Block[], b: Block): Block[] {
  return [...layout.filter((o) => o.id !== b.id), b];
}

export function bringToFront(layout: Block[], id: string): Block[] {
  const b = layout.find((o) => o.id === id);
  if (!b || layout[layout.length - 1].id === id) return layout;
  return updateBlock(layout, b);
}

/** New block of `type`, cascaded from the top-left so it is never hidden under the same spot. */
export function addBlock(layout: Block[], type: BlockType, id: string): Block[] {
  const { size, defaults } = BLOCK_TYPES[type];
  const n = layout.length % 8;
  const b = clampRect({ id, type, title: null, options: { ...defaults }, x: 0.04 + n * 0.03, y: 0.04 + n * 0.04, ...size });
  return [...layout, b];
}

export function removeBlock(layout: Block[], id: string): Block[] {
  return layout.filter((b) => b.id !== id);
}

/** Visual order (top to bottom, left to right). */
export function readingOrder<T extends Rect>(layout: T[]): T[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

const cleanOptions = (type: BlockType, raw: unknown): BlockOptions => {
  const out: BlockOptions = { ...BLOCK_TYPES[type].defaults };
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v.slice(0, 5000);
      else if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
};

const LEGACY_TYPES: Record<string, BlockType> = { recent: "entries" };

/**
 * Validate a saved layout: unknown types, duplicate ids and bad numbers are
 * dropped, rectangles are brought back inside the area. Older layouts
 * (`{ id: "clock", x, y, w, h }`, no type) are converted. Anything that is
 * not an array gives the default layout. An empty array is valid.
 */
export function normalizeLayout(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return defaultLayout();
  const out: Block[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const rawType = o.type ?? LEGACY_TYPES[id] ?? id;
    if (!/^[a-z0-9-]{1,48}$/.test(id) || !isBlockType(rawType)) continue;
    const { x, y, w, h } = o;
    if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    if ((w as number) <= 0 || (h as number) <= 0 || out.some((b) => b.id === id)) continue;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 60) : null;
    out.push(clampRect({
      id, type: rawType, title, options: cleanOptions(rawType, o.options),
      x: x as number, y: y as number, w: w as number, h: h as number,
    }));
  }
  return out;
}

/** Short random id for a new block (lowercase, safe in window labels). */
export const newBlockId = () => `b-${Math.random().toString(36).slice(2, 10)}`;
