import { describe, expect, it } from "vitest";
import type { Category, EntryData } from "../types";
import {
  isoWeek, previousWeek, renderReviewNote, renderStatsMarkdown, reviewFileName, reviewUserPrompt,
  summarizeCategories, weekLabel, type WeekStats,
} from "./week";

describe("isoWeek", () => {
  it.each([
    [new Date(2026, 10, 25), "2026-W48", "2026-11-23", "2026-11-29"],
    [new Date(2026, 10, 29), "2026-W48", "2026-11-23", "2026-11-29"], // Sunday
    [new Date(2026, 10, 30), "2026-W49", "2026-11-30", "2026-12-06"], // Monday
    [new Date(2027, 0, 1), "2026-W53", "2026-12-28", "2027-01-03"], // ISO year differs
    [new Date(2025, 11, 29), "2026-W01", "2025-12-29", "2026-01-04"],
  ])("%s → %s", (d, id, start, end) => {
    const w = isoWeek(d);
    expect([w.id, w.start, w.end]).toEqual([id, start, end]);
  });
  it("previousWeek and labels", () => {
    const w = previousWeek(isoWeek(new Date(2026, 10, 25)));
    expect(w.id).toBe("2026-W47");
    expect(weekLabel(isoWeek(new Date(2026, 10, 25)))).toBe("23 – 29 nov. 2026");
    expect(weekLabel(isoWeek(new Date(2026, 11, 1)))).toMatch(/^30 nov\. – 6 déc\. 2026$/);
    expect(reviewFileName(isoWeek(new Date(2026, 0, 7)))).toBe("bilan-2026-s02.md");
  });
});

const sport: Category = {
  id: "s", slug: "sport", name: "Sport", icon: "🏃", color: null, isSystem: false,
  schema: { fields: [
    { key: "activity", label: "Activité", type: "text", take: "rest" },
    { key: "distance_km", label: "Distance", type: "distance" },
    { key: "duration_min", label: "Durée", type: "duration" },
  ] },
};
const cuisine: Category = {
  id: "c", slug: "cuisine", name: "Cuisine", icon: "🍳", color: null, isSystem: false,
  schema: { fields: [{ key: "dish", label: "Plat", type: "text", take: "rest" }] },
};

const entries: { categoryId: string; occurredAt: string; data: EntryData }[] = [
  { categoryId: "s", occurredAt: new Date(2026, 10, 23, 8).toISOString(), data: { activity: "course", distance_km: 5, duration_min: 28 } },
  { categoryId: "s", occurredAt: new Date(2026, 10, 23, 18).toISOString(), data: { activity: "vélo", distance_km: 7.5 } },
  { categoryId: "s", occurredAt: new Date(2026, 10, 25, 8).toISOString(), data: { activity: "course", duration_min: 50 } },
  { categoryId: "c", occurredAt: new Date(2026, 10, 24, 20).toISOString(), data: { dish: "pâtes" } },
];

describe("summarizeCategories", () => {
  it("counts entries, days and sums numeric fields", () => {
    const [s, c] = summarizeCategories(entries, [sport, cuisine]);
    expect(s.count).toBe(3);
    expect(s.days).toBe(2);
    expect(s.totals).toEqual(["Distance : 12,5 km", "Durée : 1 h 18"]);
    expect(c.totals).toEqual([]);
    expect(c.examples).toEqual(["pâtes"]);
  });
});

const stats: WeekStats = {
  week: isoWeek(new Date(2026, 10, 25)),
  categories: summarizeCategories(entries, [sport, cuisine]),
  tasksDone: ["réviser BTS", "courses"],
  tasksOpen: 3,
  tasksOverdue: ["rendre dossier"],
  activity: { totalSeconds: 36_000, days: 5, topApps: [{ app: "Code", seconds: 20_000 }, { app: "Fire|fox", seconds: 9_000 }] },
  streaks: [{ name: "Sport", current: 3 }],
};

describe("markdown", () => {
  it("stats section", () => {
    const md = renderStatsMarkdown(stats);
    expect(md).toContain("- **🏃 Sport** : 3 entrées sur 2 jours · Distance : 12,5 km · Durée : 1 h 18");
    expect(md).toContain("- **🍳 Cuisine** : 1 entrée sur 1 jour");
    expect(md).toContain("- En retard : rendre dossier");
    expect(md).toContain("Temps actif : 10 h 00 (moyenne 2 h 00 par jour suivi).");
    expect(md).toContain("| Fire/fox | 2 h 30 |");
    expect(md).toContain("Séries en cours : Sport 3 j.");
  });
  it("no activity", () => {
    expect(renderStatsMarkdown({ ...stats, activity: null })).toContain("ActivityWatch indisponible.");
  });
  it("prompt contains numbers and examples", () => {
    const p = reviewUserPrompt(stats);
    expect(p).toContain("Semaine 48 (23 – 29 nov. 2026).");
    expect(p).toContain("- Sport : course · 5 km · 28 min");
    expect(p).toContain("Tâches faites : réviser BTS ; courses");
  });
  it("note: title, AI text without its own h1, stats", () => {
    const note = renderReviewNote(stats, "# Titre IA\n\n## En bref\nBonne semaine.", "Ollama", new Date(2026, 10, 30, 9));
    expect(note.startsWith("# Bilan semaine 48 (23 – 29 nov. 2026)")).toBe(true);
    expect(note).not.toContain("Titre IA");
    expect(note).toContain("## En bref\nBonne semaine.");
    expect(note).toContain("## Chiffres de la semaine");
  });
  it("note without AI", () => {
    expect(renderReviewNote(stats, null, "Ollama", new Date())).toContain("Pas de texte IA");
  });
});
