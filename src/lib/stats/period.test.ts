import { describe, expect, it } from "vitest";
import { compare, countByDay, periodBounds } from "./period";

describe("stats period", () => {
  const now = new Date(2026, 10, 27, 15, 0); // 27 nov. 2026, 15:00 local

  it("bounds of 7 and 30 days", () => {
    const w = periodBounds("week", now);
    expect(w.days).toHaveLength(7);
    expect(w.days[0]).toBe("2026-11-21");
    expect(w.days[6]).toBe("2026-11-27");
    expect(w.from.getDate()).toBe(21);
    expect(w.prevFrom.getDate()).toBe(14);
    expect(w.prevTo).toBe(w.from);
    expect(periodBounds("month", now).days[0]).toBe("2026-10-29");
  });

  it("counts per local day", () => {
    const days = ["2026-11-26", "2026-11-27"];
    const t = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    expect(countByDay([t(26, 9), t(27, 10), t(27, 23), t(20, 9)], days)).toEqual([1, 2]);
  });

  it("compares with the previous period", () => {
    expect(compare(5, 2)).toEqual({ text: "+3", dir: "up" });
    expect(compare(2, 5)).toEqual({ text: "−3", dir: "down" });
    expect(compare(4, 4)).toEqual({ text: "=", dir: "same" });
  });
});
