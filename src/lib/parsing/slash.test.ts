import { describe, expect, it } from "vitest";
import type { Category, FieldDef } from "../types";
import { parseCatArgs, parseInput, slugify } from "./slash";
import { parseDistance, parseDuration, parseMoney, parseNumber } from "./units";
import { formatEntryData } from "../format";

// Same schemas as src-tauri/migrations/0002_seed.sql.
const cat = (slug: string, fields: FieldDef[]): Category => ({
  id: slug, slug, name: slug, icon: null, color: null, isSystem: false, schema: { fields },
});
const categories: Category[] = [
  cat("sport", [
    { key: "activity", label: "Activité", type: "text", take: "rest" },
    { key: "distance_km", label: "Distance", type: "distance" },
    { key: "duration_min", label: "Durée", type: "duration" },
  ]),
  cat("devoirs", [
    { key: "subject", label: "Matière", type: "text", take: "word" },
    { key: "duration_min", label: "Durée", type: "duration" },
    { key: "note", label: "Note", type: "text", take: "rest" },
  ]),
  cat("cuisine", [{ key: "dish", label: "Plat", type: "text", take: "rest" }]),
  cat("commande", [
    { key: "service", label: "Service", type: "text", take: "rest" },
    { key: "amount_eur", label: "Montant", type: "money" },
  ]),
  cat("lecture", [{ key: "pages", label: "Pages", type: "number", unit: "pages" }]),
];

const data = (input: string) => {
  const r = parseInput(input, categories);
  if (r.kind !== "entry") throw new Error(`expected entry, got ${JSON.stringify(r)}`);
  return r.data;
};

describe("units", () => {
  it.each([
    ["28min", 28], ["45mn", 45], ["1h", 60], ["1h20", 80], ["1h05min", 65], ["1.5h", 90], ["2,5h", 150],
  ])("duration %s → %d min", (t, v) => expect(parseDuration(t)).toBe(v));

  it.each([["5km", 5], ["5,5km", 5.5], ["500m", 0.5], ["10KM", 10]])(
    "distance %s → %d km", (t, v) => expect(parseDistance(t)).toBe(v));

  it.each([["18€", 18], ["18,50€", 18.5], ["18.5€", 18.5], ["12eur", 12], ["7euros", 7]])(
    "money %s → %d €", (t, v) => expect(parseMoney(t)).toBe(v));

  it("rejects other tokens", () => {
    expect(parseDuration("course")).toBeNull();
    expect(parseDistance("28min")).toBeNull();
    expect(parseMoney("18")).toBeNull();
    expect(parseNumber("30pages", "pages")).toBe(30);
    expect(parseNumber("30", "pages")).toBeNull();
  });
});

describe("parseInput — seed categories (brief examples)", () => {
  it("/sport course 5km 28min", () => {
    expect(data("/sport course 5km 28min")).toEqual({ activity: "course", distance_km: 5, duration_min: 28 });
  });
  it("/sport accepts 1h20, 500m and any order", () => {
    expect(data("/sport 1h20 natation 500m")).toEqual({ activity: "natation", distance_km: 0.5, duration_min: 80 });
  });
  it("/sport multi-word activity", () => {
    expect(data("/sport vélo de route 30km")).toEqual({ activity: "vélo de route", distance_km: 30 });
  });
  it("/commande ubereats 18€", () => {
    expect(data("/commande ubereats 18€")).toEqual({ service: "ubereats", amount_eur: 18 });
  });
  it("/commande accepts 18,50€ and 18.5 €", () => {
    expect(data("/commande deliveroo 18,50€").amount_eur).toBe(18.5);
    expect(data("/commande deliveroo 18.5 €").amount_eur).toBe(18.5);
  });
  it("/cuisine pâtes carbo", () => {
    expect(data("/cuisine pâtes carbo")).toEqual({ dish: "pâtes carbo" });
  });
  it("/devoirs maths 45min exercices p.12", () => {
    expect(data("/devoirs maths 45min exercices p.12")).toEqual({
      subject: "maths", duration_min: 45, note: "exercices p.12",
    });
  });
  it("number + separate unit: 28 min", () => {
    expect(data("/sport course 28 min")).toEqual({ activity: "course", duration_min: 28 });
  });
  it("tolerates plural, case and accents in the command", () => {
    expect(data("/Commandes ubereats 18€").service).toBe("ubereats");
    expect(data("/devoir maths").subject).toBe("maths");
  });
  it("second value of the same type goes to text", () => {
    expect(data("/sport course 5km 10km")).toEqual({ activity: "course 10km", distance_km: 5 });
  });
});

describe("parseInput — custom category and leftovers", () => {
  it("unit field + leftovers in note", () => {
    expect(data("/lecture 30pages dune chapitre 4")).toEqual({ pages: 30, note: "dune chapitre 4" });
  });
  it("number + separate unit: 30 pages", () => {
    expect(data("/lecture 30 pages").pages).toBe(30);
  });
});

describe("parseInput — other kinds", () => {
  it("free text goes to the AI", () => {
    expect(parseInput("j'ai couru 5 km ce matin", categories)).toEqual({
      kind: "freetext", text: "j'ai couru 5 km ce matin",
    });
  });
  it("builtins", () => {
    expect(parseInput("/tache réviser BTS", categories)).toEqual({ kind: "builtin", command: "tache", args: "réviser BTS" });
    expect(parseInput("/tâche x", categories).kind).toBe("builtin");
    expect(parseInput("/claude ~/projets/lifeos", categories)).toEqual({
      kind: "builtin", command: "claude", args: "~/projets/lifeos",
    });
  });
  it("errors", () => {
    expect(parseInput("", categories).kind).toBe("error");
    expect(parseInput("/", categories).kind).toBe("error");
    expect(parseInput("/inconnu truc", categories).kind).toBe("error");
    expect(parseInput("/sport", categories).kind).toBe("error");
  });
});

describe("parseCatArgs", () => {
  it("name, icon and typed fields", () => {
    expect(parseCatArgs("lecture 📖 livre:texte pages:nombre durée:durée")).toEqual({
      slug: "lecture",
      name: "Lecture",
      icon: "📖",
      fields: [
        { key: "livre", label: "Livre", type: "text", take: "rest" },
        { key: "pages", label: "Pages", type: "number", unit: "pages" },
        { key: "duree", label: "Durée", type: "duration" },
      ],
    });
  });
  it("icon as a Lucide name", () => {
    expect(parseCatArgs("lecture icone:Book-Open pages:nombre")).toMatchObject({ icon: "book-open", fields: [{ key: "pages" }] });
    expect(parseCatArgs("musique icon:music")).toMatchObject({ icon: "music", fields: [] });
  });
  it("name only", () => {
    expect(parseCatArgs("méditation")).toEqual({ slug: "meditation", name: "Méditation", icon: null, fields: [] });
  });
  it("several text fields: one word each, last takes the rest", () => {
    const r = parseCatArgs("film titre:texte avis:texte");
    expect("fields" in r && r.fields.map((f) => f.take)).toEqual(["word", "rest"]);
  });
  it("errors", () => {
    expect(parseCatArgs("")).toHaveProperty("error");
    expect(parseCatArgs("tache")).toHaveProperty("error");
    expect(parseCatArgs("x pages:inconnu")).toHaveProperty("error");
    expect(parseCatArgs("x pages")).toHaveProperty("error");
    expect(parseCatArgs("x a:texte a:nombre")).toHaveProperty("error");
  });
});

describe("helpers", () => {
  it("slugify", () => expect(slugify("Tâche Ménagère")).toBe("tache-menagere"));
  it("formatEntryData", () => {
    expect(formatEntryData(categories[0], { activity: "course", distance_km: 5, duration_min: 80 }))
      .toBe("course · 5 km · 1 h 20");
    expect(formatEntryData(categories[3], { service: "ubereats", amount_eur: 18.5 }))
      .toMatch(/^ubereats · 18,50\s€$/);
  });
});
