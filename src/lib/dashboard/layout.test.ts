import { describe, expect, it } from "vitest";
import {
  addBlock, blockTitle, bringToFront, clampRect, DEFAULT_LAYOUT, defaultLayout, dragRect, normalizeLayout,
  readingOrder, removeBlock, snapRect, updateBlock, type Block,
} from "./layout";

const r = (id: string, x: number, y: number, w: number, h: number): Block =>
  ({ id, type: "tasks", title: null, options: { scope: "today", project: "", category: "" }, x, y, w, h });
const min = { w: 0.1, h: 0.1 };

describe("home layout", () => {
  it("default layout stays inside the area", () => {
    for (const d of DEFAULT_LAYOUT) {
      const c = clampRect(d);
      for (const k of ["x", "y", "w", "h"] as const) expect(c[k]).toBeCloseTo(d[k], 6);
    }
  });

  it("clamps inside the area and to the minimum size", () => {
    expect(clampRect(r("a", 0.95, -0.2, 0.3, 0.01), min)).toMatchObject({ x: 0.7, y: 0, w: 0.3, h: 0.1 });
    expect(clampRect(r("a", 0, 0, 3, 3))).toMatchObject({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("moves freely and resizes by edge or corner", () => {
    const out = dragRect(r("t", 0.2, 0.2, 0.3, 0.3), "move", 0.137, -0.05, min);
    expect(out.x).toBeCloseTo(0.337);
    expect(out.y).toBeCloseTo(0.15);
    const s = r("t", 0.5, 0.5, 0.3, 0.3);
    expect(dragRect(s, "e", 0.1, 0.4, min)).toMatchObject({ w: 0.4, h: 0.3 });
    expect(dragRect(s, "se", 0.9, -0.9, min)).toMatchObject({ x: 0.5, y: 0.5, w: 0.5, h: 0.1 });
    expect(dragRect(s, "move", 0, 0, min).options).toEqual(s.options); // the rest of the block is kept
  });

  it("snaps edges to the area and to other blocks", () => {
    const other = r("o", 0.5, 0.1, 0.2, 0.2);
    const snapped = snapRect(r("t", 0.008, 0.105, 0.2, 0.2), [other], "move", 0.01);
    expect(snapped.x).toBe(0);
    expect(snapped.y).toBeCloseTo(0.1);
    expect(snapRect(r("t", 0.2, 0.6, 0.2, 0.2), [other], "move", 0.01)).toMatchObject({ x: 0.2, y: 0.6 });
  });

  it("several blocks of a type, stacking order, removal", () => {
    let l = addBlock([], "tasks", "b-1");
    l = addBlock(l, "tasks", "b-2");
    expect(l.map((b) => b.id)).toEqual(["b-1", "b-2"]);
    expect(l[0].options).toEqual({ scope: "today", project: "", category: "" });
    expect(l[1].x).toBeGreaterThan(l[0].x); // cascaded
    expect(bringToFront(l, "b-1").map((b) => b.id)).toEqual(["b-2", "b-1"]);
    expect(updateBlock(l, { ...l[0], title: "Boulot" }).map((b) => b.title)).toEqual([null, "Boulot"]);
    expect(removeBlock(l, "b-1").map((b) => b.id)).toEqual(["b-2"]);
  });

  it("titles: the user's, else the type's name", () => {
    expect(blockTitle({ type: "entries", title: null })).toBe("Journal des habitudes");
    expect(blockTitle({ type: "tasks", title: "  À faire au boulot " })).toBe("À faire au boulot");
    expect(blockTitle({ type: "tasks", title: "   " })).toBe("Tâches");
  });

  it("reading order goes top to bottom, then left to right", () => {
    expect(readingOrder([r("c", 0.5, 0.5, 0.1, 0.1), r("a", 0.6, 0, 0.1, 0.1), r("b", 0, 0.5, 0.1, 0.1)]).map((x) => x.id))
      .toEqual(["a", "b", "c"]);
  });

  it("normalizes saved layouts, older ones included", () => {
    expect(normalizeLayout("nope")).toEqual(defaultLayout());
    expect(normalizeLayout([])).toEqual([]);
    const out = normalizeLayout([
      { id: "clock", x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, // older format: id = type
      { id: "recent", x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, // older name of "entries"
      { id: "b-x", type: "memo", title: "  Courses ", options: { text: "pain", evil: 3 }, x: 0.9, y: 0.9, w: 0.3, h: 0.3 },
      { id: "b-y", type: "ghost", x: 0, y: 0, w: 0.2, h: 0.2 }, // unknown type
      { id: "BAD ID", type: "memo", x: 0, y: 0, w: 0.2, h: 0.2 },
      { id: "clock", type: "clock", x: 0, y: 0, w: 0.2, h: 0.2 }, // duplicate id
      { id: "b-z", type: "tasks", x: "a", y: 0, w: 0.2, h: 0.2 }, // bad number
    ]);
    expect(out.map((b) => [b.id, b.type])).toEqual([["clock", "clock"], ["recent", "entries"], ["b-x", "memo"]]);
    expect(out[0].options).toEqual({ seconds: false });
    expect(out[2]).toMatchObject({ title: "Courses", options: { text: "pain" }, x: 0.7, y: 0.7 });
    expect(out[2].options).not.toHaveProperty("evil");
  });
});
