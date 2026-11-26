import { describe, expect, it } from "vitest";
import { parseTaskArgs } from "./task";
import { addDays, formatDay, parseDateWord } from "../dates";

// Wednesday 25 November 2026, 18:00.
const now = new Date(2026, 10, 25, 18, 0);

describe("parseDateWord", () => {
  it.each([
    ["auj", "2026-11-25"],
    ["aujourd'hui", "2026-11-25"],
    ["demain", "2026-11-26"],
    ["après-demain", "2026-11-27"],
    ["vendredi", "2026-11-27"],
    ["mercredi", "2026-11-25"],
    ["lundi", "2026-11-30"],
    ["28/11", "2026-11-28"],
    ["3/1", "2027-01-03"],
    ["20/11", "2027-11-20"],
    ["28/11/2026", "2026-11-28"],
    ["2026-12-01", "2026-12-01"],
  ])("%s → %s", (w, d) => expect(parseDateWord(w, now)).toBe(d));

  it.each(["31/02", "2026-13-01", "bientot", "32/12"])("rejects %s", (w) =>
    expect(parseDateWord(w, now)).toBeNull());
});

describe("parseTaskArgs", () => {
  it("title only", () =>
    expect(parseTaskArgs("réviser BTS", now)).toEqual({ title: "réviser BTS", dueDate: null, category: null, priority: null }));
  it("due date anywhere", () =>
    expect(parseTaskArgs("rendre @vendredi le dossier", now)).toEqual({ title: "rendre le dossier", dueDate: "2026-11-27", category: null, priority: null }));
  it("category and priority", () =>
    expect(parseTaskArgs("rendre #Projet_BTS le dossier !haute @demain", now)).toEqual({
      title: "rendre le dossier", dueDate: "2026-11-26", category: "Projet BTS", priority: 1,
    }));
  it("priority aliases", () => {
    for (const [w, p] of [["!1", 1], ["!urgent", 1], ["!moyenne", 2], ["!Basse", 3]] as const) {
      expect(parseTaskArgs(`x ${w}`, now)).toMatchObject({ priority: p });
    }
  });
  it("errors", () => {
    expect(parseTaskArgs("", now)).toHaveProperty("error");
    expect(parseTaskArgs("@demain", now)).toHaveProperty("error");
    expect(parseTaskArgs("x @bientot", now)).toHaveProperty("error");
    expect(parseTaskArgs("x !peut-etre", now)).toHaveProperty("error");
  });
});

describe("dates helpers", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("formatDay", () => {
    expect(formatDay("2026-11-25", now)).toBe("aujourd'hui");
    expect(formatDay("2026-11-26", now)).toBe("demain");
    expect(formatDay("2026-11-24", now)).toBe("hier");
  });
});
