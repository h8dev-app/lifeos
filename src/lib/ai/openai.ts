/** OpenAI API with the user's own key, through Rust (`secure_fetch`). */
import { secretExists, secureFetch } from "../secrets";
import { httpError, makeProvider, type ProviderStatus } from "./provider";

export function openaiProvider(model: string) {
  return makeProvider({
    id: "openai",
    label: `OpenAI (${model})`,

    async status(): Promise<ProviderStatus> {
      return (await secretExists("openai_api_key"))
        ? { ok: true }
        : { ok: false, reason: "Clé API OpenAI absente (Réglages)." };
    },

    complete: (system, user, schema) =>
      call(system, user, { type: "json_schema", json_schema: { name: "entry", strict: true, schema } }),
    write: (system, user) => call(system, user, null),
  });

  async function call(system: string, user: string, responseFormat: object | null): Promise<string> {
    const res = await secureFetch(
      "https://api.openai.com/v1/chat/completions",
      "POST",
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      },
      "openai_api_key",
    );
    if (res.status !== 200) throw httpError("OpenAI", res.status, res.body);
    const json = JSON.parse(res.body) as { choices?: { message?: { content?: string; refusal?: string } }[] };
    const message = json.choices?.[0]?.message;
    if (message?.refusal) throw new Error(`OpenAI a refusé : ${message.refusal}`);
    return message?.content ?? "";
  }
}
