/**
 * Home screen layout: free placement. Each widget is a rectangle in
 * fractions of the home area (0..1), so the layout follows the window size.
 * Overlap is allowed; array order is the stacking order (last = on top).
 * Pure logic, saved as JSON in the settings store.
 */

export type WidgetId = "clock" | "streaks" | "agenda" | "tasks" | "recent" | "activity";

export interface Rect {
  id: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum size in fractions of the home area (computed from pixels by the view). */
export interface MinSize {
  w: number;
  h: number;
}

/** Minimum sizes in pixels. */
export const WIDGETS: Record<WidgetId, { label: string; minW: number; minH: number }> = {
  clock: { label: "Horloge", minW: 160, minH: 90 },
  streaks: { label: "Séries", minW: 200, minH: 80 },
  agenda: { label: "Agenda", minW: 240, minH: 140 },
  tasks: { label: "Tâches du jour", minW: 240, minH: 140 },
  recent: { label: "Dernières entrées", minW: 260, minH: 140 },
  activity: { label: "Activité du jour", minW: 240, minH: 140 },
};

export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

export const DEFAULT_LAYOUT: Rect[] = [
  { id: "clock", x: 0, y: 0, w: 0.32, h: 0.24 },
  { id: "streaks", x: 0.34, y: 0, w: 0.66, h: 0.24 },
  { id: "agenda", x: 0, y: 0.27, w: 0.32, h: 0.73 },
  { id: "tasks", x: 0.34, y: 0.27, w: 0.32, h: 0.73 },
  { id: "recent", x: 0.68, y: 0.27, w: 0.32, h: 0.355 },
  { id: "activity", x: 0.68, y: 0.645, w: 0.32, h: 0.355 },
];

export const defaultLayout = (): Rect[] => DEFAULT_LAYOUT.map((r) => ({ ...r }));

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Keep a rectangle inside the area and above its minimum size. */
export function clampRect(r: Rect, min: MinSize = { w: 0, h: 0 }): Rect {
  const w = clamp(r.w, Math.min(min.w, 1), 1);
  const h = clamp(r.h, Math.min(min.h, 1), 1);
  return { id: r.id, x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}

export type Handle = "move" | "e" | "s" | "se";

/** Apply a pointer delta (fractions) to the rectangle the drag started from. */
export function dragRect(start: Rect, handle: Handle, dx: number, dy: number, min: MinSize): Rect {
  if (handle === "move") return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, min);
  const w = handle === "s" ? start.w : clamp(start.w + dx, min.w, 1 - start.x);
  const h = handle === "e" ? start.h : clamp(start.h + dy, min.h, 1 - start.y);
  return { ...start, w, h };
}

/**
 * Magnetic alignment: edges closer than `threshold` to an edge of the area
 * or of another widget stick to it. Moves keep the size; resizes move only
 * the dragged edges.
 */
export function snapRect(r: Rect, others: Rect[], handle: Handle, threshold: number): Rect {
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

/** Replace one widget's rectangle and put it on top. */
export function updateRect(layout: Rect[], r: Rect): Rect[] {
  return [...layout.filter((o) => o.id !== r.id), r];
}

export function bringToFront(layout: Rect[], id: WidgetId): Rect[] {
  const r = layout.find((o) => o.id === id);
  if (!r || layout[layout.length - 1].id === id) return layout;
  return updateRect(layout, r);
}

/** Show a hidden widget at its default place, on top. */
export function addWidget(layout: Rect[], id: WidgetId): Rect[] {
  if (layout.some((r) => r.id === id)) return layout;
  return [...layout, { ...DEFAULT_LAYOUT.find((r) => r.id === id)! }];
}

export function removeWidget(layout: Rect[], id: WidgetId): Rect[] {
  return layout.filter((r) => r.id !== id);
}

/** Visual order (top to bottom, left to right), used for keyboard focus order. */
export function readingOrder(layout: Rect[]): Rect[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Validate a saved layout: unknown ids, duplicates and bad numbers are
 * dropped, rectangles are brought back inside the area. Anything that is
 * not an array gives the default layout. An empty array is valid.
 */
export function normalizeLayout(raw: unknown): Rect[] {
  if (!Array.isArray(raw)) return defaultLayout();
  const out: Rect[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, x, y, w, h } = item as Record<string, unknown>;
    if (typeof id !== "string" || !(id in WIDGETS)) continue;
    if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    if ((w as number) <= 0 || (h as number) <= 0 || out.some((r) => r.id === id)) continue;
    out.push(clampRect({ id: id as WidgetId, x: x as number, y: y as number, w: w as number, h: h as number }));
  }
  return out;
}
