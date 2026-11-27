import { describe, expect, it } from "vitest";
import {
  atMinutes, dueReminders, layoutDay, minutesOf, monthGrid, parseEventArgs, parseTimeWord, reminderTime,
  snapMinutes, weekDays, type AgendaEvent,
} from "./agenda";

const now = new Date(2026, 10, 26, 10, 0); // Thursday 26 Nov 2026, 10:00

describe("times", () => {
  it.each([["14h30", 870], ["14h", 840], ["9:05", 545], ["0h", 0], ["23:59", 1439]])("%s → %d", (w, m) =>
    expect(parseTimeWord(w)).toBe(m));
  it.each(["24h", "14h60", "midi", "1430", "h30"])("rejects %s", (w) => expect(parseTimeWord(w)).toBeNull());
  it("round trip local minutes", () => {
    expect(minutesOf(atMinutes("2026-11-26", 870))).toBe(870);
    expect(snapMinutes(608)).toBe(615);
    expect(snapMinutes(-20)).toBe(0);
    expect(snapMinutes(2000)).toBe(1425);
  });
});

describe("parseEventArgs", () => {
  it("appointment with date, time and place", () => {
    expect(parseEventArgs("Dentiste @demain 14h30 *Cabinet_Dupont", "event", now)).toEqual({
      title: "Dentiste", day: "2026-11-27", allDay: false, start: 870, end: 930, location: "Cabinet Dupont", project: null,
    });
    expect(parseEventArgs("Point client 10h +lifeos", "event", now)).toMatchObject({ title: "Point client", project: "lifeos" });
  });
  it("time range", () => {
    expect(parseEventArgs("Réunion projet 9h-10h30 @lundi", "event", now)).toMatchObject({
      title: "Réunion projet", day: "2026-11-30", start: 540, end: 630,
    });
  });
  it("memo all day, memo with time, default day = today", () => {
    expect(parseEventArgs("payer le loyer @vendredi", "memo", now)).toMatchObject({ title: "payer le loyer", day: "2026-11-27", allDay: true, start: null, end: null });
    expect(parseEventArgs("appeler maman 18h", "memo", now)).toMatchObject({ day: "2026-11-26", allDay: false, start: 1080, end: null });
  });
  it("errors", () => {
    expect(parseEventArgs("Dentiste @demain", "event", now)).toHaveProperty("error");
    expect(parseEventArgs("@demain 14h", "event", now)).toHaveProperty("error");
    expect(parseEventArgs("x 10h-9h", "event", now)).toHaveProperty("error");
    expect(parseEventArgs("x @bientot 9h", "event", now)).toHaveProperty("error");
  });
});

describe("grids", () => {
  it("week starts on Monday", () => {
    expect(weekDays("2026-11-26")).toEqual([
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29",
    ]);
    expect(weekDays("2026-11-29")[0]).toBe("2026-11-23");
    expect(weekDays("2026-11-30")[0]).toBe("2026-11-30");
  });
  it("month grid: 6 weeks from the Monday before the 1st", () => {
    const g = monthGrid("2026-11-26");
    expect(g).toHaveLength(6);
    expect(g[0][0]).toBe("2026-10-26");
    expect(g[0][6]).toBe("2026-11-01");
    expect(g[5][6]).toBe("2026-12-06");
  });
});

describe("layoutDay", () => {
  it("overlapping items share the width, others take the full width", () => {
    const placed = layoutDay([
      { item: "a", start: 540, end: 600 },
      { item: "b", start: 570, end: 630 },
      { item: "c", start: 600, end: 660 },
      { item: "d", start: 720, end: 780 },
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.item, [p.col, p.cols]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});

const ev = (o: Partial<AgendaEvent>): AgendaEvent => ({
  id: "x", title: "x", kind: "event", day: "2026-11-26", allDay: false, startAt: atMinutes("2026-11-26", 600),
  endAt: null, location: null, description: null, remindMinutes: 15, remindedAt: null, noteId: null, projectId: null, ...o,
});

describe("reminders", () => {
  it("time of the reminder", () => {
    expect(reminderTime(ev({}))).toBe(atMinutes("2026-11-26", 585));
    expect(reminderTime(ev({ allDay: true, startAt: null, remindMinutes: 0 }))).toBe(atMinutes("2026-11-26", 540));
    expect(reminderTime(ev({ remindMinutes: null }))).toBeNull();
  });
  it("due now, not twice, not too late", () => {
    const at = (h: number, m: number) => new Date(2026, 10, 26, h, m);
    expect(dueReminders([ev({})], at(9, 44))).toHaveLength(0);
    expect(dueReminders([ev({})], at(9, 45))).toHaveLength(1);
    expect(dueReminders([ev({ remindedAt: "2026-11-26T08:45:00Z" })], at(9, 50))).toHaveLength(0);
    expect(dueReminders([ev({})], at(11, 0))).toHaveLength(0); // 75 min late > 60 min grace
  });
});
