import { describe, expect, it } from "vitest";
import { computeStreaks, streakFor } from "./streaks";

const T = "2026-11-25";

describe("streakFor", () => {
  it("counts consecutive days ending today", () => {
    expect(streakFor(["2026-11-23", "2026-11-24", "2026-11-25"], T)).toEqual({ current: 3, doneToday: true, best: 3 });
  });
  it("still alive when the last entry was yesterday", () => {
    expect(streakFor(["2026-11-23", "2026-11-24"], T)).toEqual({ current: 2, doneToday: false, best: 2 });
  });
  it("broken when the last entry is older", () => {
    expect(streakFor(["2026-11-20", "2026-11-21", "2026-11-22"], T)).toEqual({ current: 0, doneToday: false, best: 3 });
  });
  it("crosses month boundaries, ignores duplicates", () => {
    expect(streakFor(["2026-10-31", "2026-11-01", "2026-11-01"], "2026-11-01").current).toBe(2);
  });
  it("best run elsewhere", () => {
    expect(streakFor(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-25"], T)).toEqual({ current: 1, doneToday: true, best: 4 });
  });
  it("empty", () => expect(streakFor([], T)).toEqual({ current: 0, doneToday: false, best: 0 }));
});

describe("computeStreaks", () => {
  it("keeps streaks ≥ 2 days, longest first", () => {
    const rows = [
      { categoryId: "sport", day: "2026-11-24" }, { categoryId: "sport", day: "2026-11-25" },
      { categoryId: "code", day: "2026-11-22" }, { categoryId: "code", day: "2026-11-23" }, { categoryId: "code", day: "2026-11-24" },
      { categoryId: "cuisine", day: "2026-11-25" },
    ];
    expect(computeStreaks(rows, T).map((s) => [s.categoryId, s.current])).toEqual([["code", 3], ["sport", 2]]);
  });
});
