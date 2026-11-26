import { describe, expect, it } from "vitest";
import {
  addWidget, bringToFront, clampRect, DEFAULT_LAYOUT, defaultLayout, dragRect, normalizeLayout,
  readingOrder, removeWidget, snapRect, updateRect, type Rect,
} from "./layout";

const r = (id: Rect["id"], x: number, y: number, w: number, h: number): Rect => ({ id, x, y, w, h });
const min = { w: 0.1, h: 0.1 };

describe("free layout", () => {
  it("default layout stays inside the area", () => {
    for (const d of DEFAULT_LAYOUT) {
      const c = clampRect(d);
      for (const k of ["x", "y", "w", "h"] as const) expect(c[k]).toBeCloseTo(d[k], 6);
    }
  });

  it("clamps inside the area and to the minimum size", () => {
    expect(clampRect(r("clock", 0.95, -0.2, 0.3, 0.01), min)).toEqual(r("clock", 0.7, 0, 0.3, 0.1));
    expect(clampRect(r("clock", 0, 0, 3, 3))).toEqual(r("clock", 0, 0, 1, 1));
  });

  it("moves freely, anywhere, without a grid", () => {
    const out = dragRect(r("tasks", 0.2, 0.2, 0.3, 0.3), "move", 0.137, -0.05, min);
    expect(out.x).toBeCloseTo(0.337);
    expect(out.y).toBeCloseTo(0.15);
    expect(dragRect(r("tasks", 0.2, 0.2, 0.3, 0.3), "move", 5, 5, min)).toMatchObject({ x: 0.7, y: 0.7 });
  });

  it("resizes by edge or corner, within the area and the minimum", () => {
    const s = r("tasks", 0.5, 0.5, 0.3, 0.3);
    expect(dragRect(s, "e", 0.1, 0.4, min)).toMatchObject({ w: 0.4, h: 0.3 });
    expect(dragRect(s, "s", 0.4, 0.1, min)).toMatchObject({ w: 0.3, h: 0.4 });
    expect(dragRect(s, "se", 0.9, -0.9, min)).toMatchObject({ x: 0.5, y: 0.5, w: 0.5, h: 0.1 });
  });

  it("snaps edges to the area and to other widgets", () => {
    const other = r("clock", 0.5, 0.1, 0.2, 0.2);
    // Left edge near 0, top near the other's top.
    const snapped = snapRect(r("tasks", 0.008, 0.105, 0.2, 0.2), [other], "move", 0.01);
    expect(snapped.x).toBe(0);
    expect(snapped.y).toBeCloseTo(0.1);
    // Right edge near the other's left edge.
    expect(snapRect(r("tasks", 0.295, 0.6, 0.2, 0.2), [other], "move", 0.01).x).toBeCloseTo(0.3);
    // Far from everything: unchanged.
    expect(snapRect(r("tasks", 0.2, 0.6, 0.2, 0.2), [other], "move", 0.01)).toMatchObject({ x: 0.2, y: 0.6 });
    // Resize: only the dragged edge moves.
    expect(snapRect(r("tasks", 0.1, 0.6, 0.395, 0.2), [other], "e", 0.01)).toMatchObject({ x: 0.1, w: 0.4, h: 0.2 });
  });

  it("allows overlap; the last touched widget is on top", () => {
    const l = [r("clock", 0, 0, 0.5, 0.5), r("tasks", 0.2, 0.2, 0.5, 0.5)];
    expect(bringToFront(l, "clock").map((x) => x.id)).toEqual(["tasks", "clock"]);
    expect(bringToFront(l, "tasks")).toBe(l);
    const moved = updateRect(l, r("clock", 0.1, 0.1, 0.5, 0.5));
    expect(moved.map((x) => x.id)).toEqual(["tasks", "clock"]);
  });

  it("hides and shows widgets", () => {
    const l = removeWidget(defaultLayout(), "recent");
    expect(l.some((x) => x.id === "recent")).toBe(false);
    const back = addWidget(l, "recent");
    expect(back[back.length - 1]).toEqual(DEFAULT_LAYOUT.find((x) => x.id === "recent"));
    expect(addWidget(back, "recent")).toBe(back);
  });

  it("reading order goes top to bottom, then left to right", () => {
    expect(readingOrder([r("tasks", 0.5, 0.5, 0.1, 0.1), r("clock", 0.6, 0, 0.1, 0.1), r("agenda", 0, 0.5, 0.1, 0.1)])
      .map((x) => x.id)).toEqual(["clock", "agenda", "tasks"]);
  });

  it("normalizes saved layouts", () => {
    expect(normalizeLayout("nope")).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout([])).toEqual([]);
    expect(normalizeLayout([
      r("clock", 0.1, 0.1, 0.2, 0.2),
      r("clock", 0.5, 0.5, 0.2, 0.2), // duplicate
      { id: "ghost", x: 0, y: 0, w: 0.2, h: 0.2 }, // unknown
      { id: "agenda", x: "a", y: 0, w: 0.2, h: 0.2 }, // bad number
      r("tasks", 0, 0, 0, 0.2), // empty
      r("recent", 0.9, 0.9, 0.3, 0.3), // brought back inside
      r("activity", 0.05, 0.05, 0.3, 0.3), // overlap is fine
    ])).toEqual([
      r("clock", 0.1, 0.1, 0.2, 0.2),
      r("recent", 0.7, 0.7, 0.3, 0.3),
      r("activity", 0.05, 0.05, 0.3, 0.3),
    ]);
  });
});
