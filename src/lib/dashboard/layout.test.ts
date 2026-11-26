import { describe, expect, it } from "vitest";
import {
  addWidget, clampPlacement, COLS, DEFAULT_LAYOUT, fits, freeSpot, normalizeLayout, overlaps, place,
  removeWidget, ROWS, type Placement,
} from "./layout";

const noOverlap = (l: Placement[]) =>
  l.every((a, i) => l.every((b, j) => i === j || !overlaps(a, b)));

describe("layout", () => {
  it("default layout fills the grid without overlap", () => {
    expect(noOverlap(DEFAULT_LAYOUT)).toBe(true);
    const area = DEFAULT_LAYOUT.reduce((s, p) => s + p.w * p.h, 0);
    expect(area).toBe(COLS * ROWS);
  });

  it("overlaps only when areas intersect", () => {
    const a = { id: "clock", x: 0, y: 0, w: 2, h: 2 } as const;
    expect(overlaps(a, { id: "tasks", x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(overlaps(a, { id: "tasks", x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });

  it("clamps inside the grid and to the minimum size", () => {
    expect(clampPlacement({ id: "agenda", x: 11, y: -3, w: 1, h: 1 })).toEqual({ id: "agenda", x: 9, y: 0, w: 3, h: 2 });
    expect(clampPlacement({ id: "clock", x: 0, y: 0, w: 40, h: 40 })).toEqual({ id: "clock", x: 0, y: 0, w: COLS, h: ROWS });
  });

  it("finds a free spot or null", () => {
    expect(freeSpot([], 3, 2)).toEqual({ x: 0, y: 0 });
    expect(freeSpot(DEFAULT_LAYOUT, 1, 1)).toBeNull();
    expect(freeSpot(removeWidget(DEFAULT_LAYOUT, "recent"), 4, 3)).toEqual({ x: 8, y: 2 });
  });

  it("swaps two widgets of the same size", () => {
    const out = place(DEFAULT_LAYOUT, { id: "agenda", x: 4, y: 2, w: 4, h: 6 })!;
    expect(out.find((p) => p.id === "agenda")).toMatchObject({ x: 4, y: 2 });
    expect(out.find((p) => p.id === "tasks")).toMatchObject({ x: 0, y: 2 });
    expect(noOverlap(out)).toBe(true);
  });

  it("moves into empty space without touching others", () => {
    const l = removeWidget(DEFAULT_LAYOUT, "activity");
    const out = place(l, { id: "recent", x: 8, y: 5, w: 4, h: 3 })!;
    expect(out.find((p) => p.id === "recent")).toMatchObject({ x: 8, y: 5 });
    expect(out.find((p) => p.id === "tasks")).toEqual(l.find((p) => p.id === "tasks"));
  });

  it("refuses a move when the displaced widgets cannot fit", () => {
    // Clock taking the whole grid leaves no room for anyone.
    expect(place(DEFAULT_LAYOUT, { id: "clock", x: 0, y: 0, w: COLS, h: ROWS })).toBeNull();
  });

  it("growing a widget shrinks or moves its neighbour when there is room", () => {
    const l = removeWidget(DEFAULT_LAYOUT, "activity"); // frees 4x3 at (8,5)
    const out = place(l, { id: "recent", x: 8, y: 2, w: 4, h: 4 })!;
    expect(out).not.toBeNull();
    expect(noOverlap(out)).toBe(true);
  });

  it("adds a hidden widget only where there is room", () => {
    expect(addWidget(DEFAULT_LAYOUT, "recent")).toBe(DEFAULT_LAYOUT); // already there
    const l = removeWidget(DEFAULT_LAYOUT, "recent");
    expect(addWidget(l, "recent")!.find((p) => p.id === "recent")).toEqual({ id: "recent", x: 8, y: 2, w: 4, h: 3 });
    expect(addWidget(removeWidget(l, "activity").concat(), "recent")).not.toBeNull();
    const full = place(removeWidget(DEFAULT_LAYOUT, "activity"), { id: "recent", x: 8, y: 2, w: 4, h: 6 })!;
    expect(addWidget(full, "activity")).toBeNull();
  });

  it("normalizes saved layouts", () => {
    expect(normalizeLayout("nope")).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout([])).toEqual([]);
    const out = normalizeLayout([
      { id: "clock", x: 0, y: 0, w: 4, h: 2 },
      { id: "clock", x: 6, y: 0, w: 4, h: 2 }, // duplicate
      { id: "ghost", x: 0, y: 4, w: 2, h: 2 }, // unknown
      { id: "tasks", x: 1, y: 1, w: 4, h: 4 }, // overlaps clock
      { id: "agenda", x: "a", y: 0, w: 4, h: 4 }, // bad number
      { id: "recent", x: 20, y: 6, w: 4, h: 3 }, // clamped inside
    ]);
    expect(out).toEqual([
      { id: "clock", x: 0, y: 0, w: 4, h: 2 },
      { id: "recent", x: 8, y: 5, w: 4, h: 3 },
    ]);
    expect(fits(out[0], out)).toBe(true);
  });
});
