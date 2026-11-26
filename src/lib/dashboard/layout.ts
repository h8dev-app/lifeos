/**
 * Home screen layout: widgets placed on a fixed grid (no page scroll).
 * Pure logic, saved as JSON in the settings store.
 */

export const COLS = 12;
export const ROWS = 8;

export type WidgetId = "clock" | "streaks" | "agenda" | "tasks" | "recent" | "activity";

export interface Placement {
  id: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WIDGETS: Record<WidgetId, { label: string; minW: number; minH: number }> = {
  clock: { label: "Horloge", minW: 2, minH: 1 },
  streaks: { label: "Séries", minW: 2, minH: 1 },
  agenda: { label: "Agenda", minW: 3, minH: 2 },
  tasks: { label: "Tâches du jour", minW: 3, minH: 2 },
  recent: { label: "Dernières entrées", minW: 3, minH: 2 },
  activity: { label: "Activité du jour", minW: 3, minH: 2 },
};

export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

export const DEFAULT_LAYOUT: Placement[] = [
  { id: "clock", x: 0, y: 0, w: 4, h: 2 },
  { id: "streaks", x: 4, y: 0, w: 8, h: 2 },
  { id: "agenda", x: 0, y: 2, w: 4, h: 6 },
  { id: "tasks", x: 4, y: 2, w: 4, h: 6 },
  { id: "recent", x: 8, y: 2, w: 4, h: 3 },
  { id: "activity", x: 8, y: 5, w: 4, h: 3 },
];

export function overlaps(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Keep a placement inside the grid and above the widget's minimum size. */
export function clampPlacement(p: Placement): Placement {
  const { minW, minH } = WIDGETS[p.id];
  const w = Math.min(Math.max(Math.round(p.w), minW), COLS);
  const h = Math.min(Math.max(Math.round(p.h), minH), ROWS);
  const x = Math.min(Math.max(Math.round(p.x), 0), COLS - w);
  const y = Math.min(Math.max(Math.round(p.y), 0), ROWS - h);
  return { id: p.id, x, y, w, h };
}

/** True when `p` overlaps none of `layout` (its own id excluded). */
export function fits(p: Placement, layout: Placement[]): boolean {
  return layout.every((o) => o.id === p.id || !overlaps(o, p));
}

/** First free top-left position for a w×h block, scanning row by row. */
export function freeSpot(layout: Placement[], w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= ROWS; y++) {
    for (let x = 0; x + w <= COLS; x++) {
      const probe = { id: "clock" as WidgetId, x, y, w, h };
      if (layout.every((o) => !overlaps(o, probe))) return { x, y };
    }
  }
  return null;
}

/**
 * Put `next` (moved, resized or added) into the layout. Widgets it covers are
 * moved away: first to the place `next` came from, then to any free spot,
 * then shrunk to their minimum size. Null when they cannot all fit.
 */
export function place(layout: Placement[], next: Placement): Placement[] | null {
  const target = clampPlacement(next);
  const old = layout.find((p) => p.id === target.id);
  const result: Placement[] = [target];
  const displaced: Placement[] = [];
  for (const o of layout) {
    if (o.id === target.id) continue;
    (overlaps(o, target) ? displaced : result).push(o);
  }
  // Biggest first: small ones find a hole more easily.
  displaced.sort((a, b) => b.w * b.h - a.w * a.h);
  for (const d of displaced) {
    const { minW, minH } = WIDGETS[d.id];
    const candidates: Placement[] = [];
    if (old) candidates.push(clampPlacement({ ...d, x: old.x, y: old.y }));
    const spot = freeSpot(result, d.w, d.h);
    if (spot) candidates.push({ ...d, ...spot });
    const small = freeSpot(result, minW, minH);
    if (small) candidates.push({ ...d, ...small, w: minW, h: minH });
    const ok = candidates.find((c) => fits(c, result));
    if (!ok) return null;
    result.push(ok);
  }
  return sortLayout(result);
}

/** Add a hidden widget at its minimum size, in the first free spot. */
export function addWidget(layout: Placement[], id: WidgetId): Placement[] | null {
  if (layout.some((p) => p.id === id)) return layout;
  const { minW, minH } = WIDGETS[id];
  const preferred = DEFAULT_LAYOUT.find((p) => p.id === id)!;
  for (const [w, h] of [[preferred.w, preferred.h], [minW, minH]]) {
    const spot = freeSpot(layout, w, h);
    if (spot) return sortLayout([...layout, { id, ...spot, w, h }]);
  }
  return null;
}

export function removeWidget(layout: Placement[], id: WidgetId): Placement[] {
  return layout.filter((p) => p.id !== id);
}

/** Reading order (top to bottom, left to right), also used for tab order. */
export function sortLayout(layout: Placement[]): Placement[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Validate a saved layout: unknown ids, duplicates, bad numbers and overlaps
 * are dropped. Anything that is not an array gives the default layout.
 * An empty array is valid (every widget hidden).
 */
export function normalizeLayout(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return DEFAULT_LAYOUT.map((p) => ({ ...p }));
  const out: Placement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, x, y, w, h } = item as Record<string, unknown>;
    if (typeof id !== "string" || !(id in WIDGETS)) continue;
    if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    if (out.some((p) => p.id === id)) continue;
    const p = clampPlacement({ id: id as WidgetId, x: x as number, y: y as number, w: w as number, h: h as number });
    if (fits(p, out)) out.push(p);
  }
  return sortLayout(out);
}
