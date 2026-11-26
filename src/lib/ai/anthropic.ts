/**
 * Anthropic API with the user's own key. The request goes through Rust
 * (`secure_fetch`), which adds the key from the keyring: it never reaches
 * this code. That is why this uses raw HTTP and not the Anthropic SDK
 * (the SDK would need the key in JavaScript).
 */
import { secretExists, secureFetch } from "../secrets";
import { httpError, makeProvider, type ProviderStatus } from "./provider";

/** Models that accept server-side fallbacks on refusal (Haiku does not). */
const SUPPORTS_FALLBACKS = /^claude-(opus-5-5|sonnet-5-5|fable-5)/;

export function anthropicProvider(model: string) {
  return makeProvider({
    id: "anthropic",
    label: `Anthropic (${model})`,

    async status(): Promise<ProviderStatus> {
      return (await secretExists("anthropic_api_key"))
        ? { ok: true }
        : { ok: false, reason: "Clé API Anthropic absente (Réglages)." };
    },

    complete: (system, user, schema) =>
      // Short extraction: low effort keeps it fast and cheap.
      call(system, user, { effort: "low", format: { type: "json_schema", schema } }),
    write: (system, user) => call(system, user, { effort: "medium" }),
  });

  async function call(system: string, user: string, outputConfig: object): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: outputConfig,
    };
    // On a policy refusal, the API retries on another model by itself.
    if (SUPPORTS_FALLBACKS.test(model)) body.fallbacks = "default";

    const res = await secureFetch("https://api.anthropic.com/v1/messages", "POST", body, "anthropic_api_key");
    if (res.status !== 200) throw httpError("Anthropic", res.status, res.body);

    const msg = JSON.parse(res.body) as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };
    if (msg.stop_reason === "refusal") throw new Error("Anthropic a refusé la demande.");
    if (msg.stop_reason === "max_tokens") throw new Error("Anthropic : réponse coupée (max_tokens).");
    return msg.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
  }
}
