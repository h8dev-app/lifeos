/** Ollama, local and free. Default provider. */
import { localFetch, OLLAMA_PORT } from "../localFetch";
import { httpError, makeProvider, type ProviderStatus } from "./provider";


export function ollamaProvider(model: string) {
  return makeProvider({
    id: "ollama",
    label: `Ollama (${model})`,

    async status(): Promise<ProviderStatus> {
      try {
        const res = await localFetch(OLLAMA_PORT, "/api/tags");
        if (res.status !== 200) return { ok: false, reason: `Ollama répond ${res.status}.` };
        const { models = [] } = JSON.parse(res.body) as { models?: { name: string }[] };
        const names = models.map((m) => m.name);
        const found = names.some((n) => n === model || n === `${model}:latest`);
        return found ? { ok: true } : { ok: false, reason: `Modèle absent. Lance : ollama pull ${model}` };
      } catch (e) {
        return { ok: false, reason: `Ollama injoignable sur http://127.0.0.1:11434 (${e}).` };
      }
    },

    async complete(system, user, schema) {
      const res = await localFetch(OLLAMA_PORT, "/api/chat", "POST", {
        model,
        stream: false,
        format: schema, // structured output: the reply follows the JSON schema
        options: { temperature: 0 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      if (res.status !== 200) throw httpError("Ollama", res.status, res.body);
      return (JSON.parse(res.body) as { message?: { content?: string } }).message?.content ?? "";
    },
  });
}
