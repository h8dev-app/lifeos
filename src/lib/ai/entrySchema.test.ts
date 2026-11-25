import { describe, expect, it } from "vitest";
import type { Category } from "../types";
import { buildResponseSchema, validateAiEntry } from "./entrySchema";
import { buildSystemPrompt, localIsoWithOffset } from "./prompt";

const sport: Category = {
  id: "s", slug: "sport", name: "Sport", icon: null, color: null, isSystem: false,
  schema: { fields: [
    { key: "activity", label: "Activité", type: "text", take: "rest" },
    { key: "distance_km", label: "Distance", type: "distance" },
    { key: "duration_min", label: "Durée", type: "duration" },
  ] },
};
const commande: Category = {
  id: "c", slug: "commande", name: "Commandes", icon: null, color: null, isSystem: false,
  schema: { fields: [
    { key: "service", label: "Service", type: "text", take: "rest" },
    { key: "amount_eur", label: "Montant", type: "money" },
  ] },
};
const cats = [sport, commande];
const now = new Date("2026-11-25T17:00:00Z");
const answer = (o: object) => JSON.stringify(o);

describe("validateAiEntry", () => {
  it("valid entry with numbers as strings", () => {
    const r = validateAiEntry(answer({
      category: "sport", occurred_at: "2026-11-25T08:00:00+01:00",
      fields: [{ key: "activity", value: "course" }, { key: "distance_km", value: "5" }, { key: "duration_min", value: "28" }],
    }), cats, now);
    expect(r).toEqual({
      kind: "entry", category: sport, occurredAt: "2026-11-25T07:00:00.000Z",
      data: { activity: "course", distance_km: 5, duration_min: 28 },
    });
  });

  it("accepts units, commas and code fences", () => {
    const raw = "Voici :\n```json\n" + answer({
      category: "commande", occurred_at: "",
      fields: [{ key: "service", value: "Uber Eats" }, { key: "amount_eur", value: "18,50 €" }],
    }) + "\n```";
    const r = validateAiEntry(raw, cats, now);
    expect(r.kind === "entry" && r.data).toEqual({ service: "Uber Eats", amount_eur: 18.5 });
  });

  it("converts 1h20 and 500m", () => {
    const r = validateAiEntry(answer({
      category: "sport", occurred_at: "",
      fields: [{ key: "distance_km", value: "500m" }, { key: "duration_min", value: "1h20" }],
    }), cats, now);
    expect(r.kind === "entry" && r.data).toEqual({ distance_km: 0.5, duration_min: 80 });
  });

  it("unknown keys and bad values go to note", () => {
    const r = validateAiEntry(answer({
      category: "sport", occurred_at: "",
      fields: [{ key: "activity", value: "vélo" }, { key: "distance_km", value: "beaucoup" }, { key: "humeur", value: "top" }],
    }), cats, now);
    expect(r.kind === "entry" && r.data).toEqual({ activity: "vélo", note: "Distance: beaucoup · humeur: top" });
  });

  it("missing, future or too old date → now", () => {
    for (const occurred_at of ["", "pas une date", "2026-11-26T10:00:00Z", "2026-09-01T10:00:00Z"]) {
      const r = validateAiEntry(answer({ category: "sport", occurred_at, fields: [{ key: "activity", value: "x" }] }), cats, now);
      expect(r.kind === "entry" && r.occurredAt).toBe(now.toISOString());
    }
  });

  it("nothing to log", () => {
    expect(validateAiEntry(answer({ category: "aucune", occurred_at: "", fields: [] }), cats, now)).toEqual({ kind: "none" });
  });

  it("errors", () => {
    expect(validateAiEntry("pas du json", cats, now).kind).toBe("error");
    expect(validateAiEntry(answer({ category: 3 }), cats, now).kind).toBe("error");
    expect(validateAiEntry(answer({ category: "inconnue", occurred_at: "", fields: [] }), cats, now).kind).toBe("error");
    expect(validateAiEntry(answer({ category: "sport", occurred_at: "", fields: [] }), cats, now).kind).toBe("error");
  });
});

describe("schema and prompt", () => {
  it("schema lists slugs + aucune and is strict", () => {
    const s = buildResponseSchema(cats);
    expect(s.properties.category.enum).toEqual(["sport", "commande", "aucune"]);
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.fields.items.additionalProperties).toBe(false);
  });
  it("prompt describes fields and current time", () => {
    const p = buildSystemPrompt(cats, new Date(2026, 10, 25, 18, 4));
    expect(p).toContain("- sport : Sport. Champs : activity (Activité, texte), distance_km (Distance, nombre en kilomètres)");
    expect(p).toContain("2026-11-25T18:04:00");
  });
  it("localIsoWithOffset has an offset", () => {
    expect(localIsoWithOffset(new Date(2026, 0, 1, 9, 5))).toMatch(/^2026-01-01T09:05:00[+-]\d{2}:\d{2}$/);
  });
});
