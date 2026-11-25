/**
 * AI provider interface. Adding a provider = one file with `status` and
 * `complete`, then one line in registry.ts.
 */
import type { Category } from "../types";
import { buildResponseSchema, validateAiEntry, type AiEntryResult } from "./entrySchema";
import { buildSystemPrompt } from "./prompt";

export type ProviderStatus = { ok: true } | { ok: false; reason: string };

export interface AiProvider {
  id: string;
  label: string;
  /** Can the provider be used right now? (server up, model present, key set) */
  status(): Promise<ProviderStatus>;
  /** Free text → validated entry (or "nothing to log"). */
  parseEntry(text: string, categories: Category[]): Promise<AiEntryResult>;
  /** Reserved for later (weekly reviews…). */
  chat?(messages: { role: "user" | "assistant"; content: string }[]): Promise<string>;
}

/** What each provider implements: one JSON completion constrained by a schema. */
export interface Backend {
  id: string;
  label: string;
  status(): Promise<ProviderStatus>;
  complete(system: string, user: string, schema: object): Promise<string>;
}

export function makeProvider(backend: Backend): AiProvider {
  return {
    id: backend.id,
    label: backend.label,
    status: () => backend.status(),
    async parseEntry(text, categories) {
      const raw = await backend.complete(buildSystemPrompt(categories), text, buildResponseSchema(categories));
      return validateAiEntry(raw, categories);
    },
  };
}

/** Error message of a failed HTTP call, from the JSON body when possible. */
export function httpError(service: string, status: number, body: string): Error {
  let detail = body.slice(0, 200);
  try {
    const j = JSON.parse(body);
    detail = j?.error?.message ?? j?.error ?? detail;
  } catch { /* keep raw text */ }
  if (status === 401 || status === 403) return new Error(`${service} : clé API refusée (${status}).`);
  if (status === 429) return new Error(`${service} : trop de requêtes ou crédit épuisé (429).`);
  return new Error(`${service} : erreur ${status} — ${detail}`);
}
