/** Ollama, local and free. Default provider. */
import { fetch } from "@tauri-apps/plugin-http";
import { httpError, makeProvider, type ProviderStatus } from "./provider";

// IPv4 explicitly: "localhost" may resolve to ::1 first.
const BASE = "http://127.0.0.1:11434";

export function ollamaProvider(model: string) {
  return makeProvider({
    id: "ollama",
    label: `Ollama (${model})`,

    async status(): Promise<ProviderStatus> {
      try {
        const res = await fetch(`${BASE}/api/tags`, { method: "GET", connectTimeout: 2000 });
        if (!res.ok) return { ok: false, reason: `Ollama répond ${res.status}.` };
        const { models = [] } = (await res.json()) as { models?: { name: string }[] };
        const names = models.map((m) => m.name);
        const found = names.some((n) => n === model || n === `${model}:latest`);
        return found ? { ok: true } : { ok: false, reason: `Modèle absent. Lance : ollama pull ${model}` };
      } catch (e) {
        return { ok: false, reason: `Ollama injoignable sur http://127.0.0.1:11434 (${e}).` };
      }
    },

    async complete(system, user, schema) {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: schema, // structured output: the reply follows the JSON schema
          options: { temperature: 0 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const body = await res.text();
      if (!res.ok) throw httpError("Ollama", res.status, body);
      return (JSON.parse(body) as { message?: { content?: string } }).message?.content ?? "";
    },
  });
}
