/**
 * Live check of the prompt against a local Ollama. Skipped unless
 * LIVE_OLLAMA=1:  LIVE_OLLAMA=1 npx vitest run ollama.live
 */
import { describe, expect, it } from "vitest";
import type { Category } from "../types";
import { buildResponseSchema, validateAiEntry } from "./entrySchema";
import { buildSystemPrompt } from "./prompt";

const f = (key: string, label: string, type: any, extra = {}) => ({ key, label, type, ...extra });
const cats: Category[] = [
  { id: "1", slug: "sport", name: "Sport", icon: null, color: null, isSystem: false,
    schema: { fields: [f("activity", "Activité", "text", { take: "rest" }), f("distance_km", "Distance", "distance"), f("duration_min", "Durée", "duration")] } },
  { id: "2", slug: "devoirs", name: "Devoirs", icon: null, color: null, isSystem: false,
    schema: { fields: [f("subject", "Matière", "text", { take: "word" }), f("duration_min", "Durée", "duration"), f("note", "Note", "text", { take: "rest" })] } },
  { id: "3", slug: "cuisine", name: "Cuisine", icon: null, color: null, isSystem: false,
    schema: { fields: [f("dish", "Plat", "text", { take: "rest" })] } },
  { id: "4", slug: "commande", name: "Commandes", icon: null, color: null, isSystem: false,
    schema: { fields: [f("service", "Service", "text", { take: "rest" }), f("amount_eur", "Montant", "money")] } },
];

async function ask(text: string) {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b", stream: false, format: buildResponseSchema(cats),
      options: { temperature: 0 },
      messages: [{ role: "system", content: buildSystemPrompt(cats) }, { role: "user", content: text }],
    }),
  });
  const raw = ((await res.json()) as any).message.content as string;
  const r = validateAiEntry(raw, cats);
  console.log(text, "→", JSON.stringify(r.kind === "entry" ? { cat: r.category.slug, ...r.data, at: r.occurredAt } : r));
  return r;
}

describe.runIf(process.env.LIVE_OLLAMA === "1")("ollama live", () => {
  it("sport", async () => {
    const r = await ask("j'ai couru 5 km ce matin en 28 minutes");
    expect(r.kind === "entry" && r.category.slug).toBe("sport");
    expect(r.kind === "entry" && r.data.distance_km).toBe(5);
  }, 120_000);
  it("commande", async () => {
    const r = await ask("commandé un burger sur deliveroo pour 14,90€");
    expect(r.kind === "entry" && r.category.slug).toBe("commande");
    expect(r.kind === "entry" && r.data.amount_eur).toBe(14.9);
  }, 120_000);
  it("devoirs", async () => {
    const r = await ask("1h20 de maths hier soir, chapitre sur les suites");
    expect(r.kind === "entry" && r.category.slug).toBe("devoirs");
    expect(r.kind === "entry" && r.data.duration_min).toBe(80);
  }, 120_000);
  it("cuisine", async () => {
    const r = await ask("j'ai fait un gratin dauphinois");
    expect(r.kind === "entry" && r.category.slug).toBe("cuisine");
  }, 120_000);
  it("nothing", async () => {
    const r = await ask("il fait beau aujourd'hui");
    expect(r.kind).toBe("none");
  }, 120_000);
});
