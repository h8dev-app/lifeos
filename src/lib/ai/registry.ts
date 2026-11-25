/** Provider chosen in the settings. */
import type { Settings } from "../settings";
import { anthropicProvider } from "./anthropic";
import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import type { AiProvider } from "./provider";

export function getProvider(s: Settings): AiProvider {
  switch (s.aiProvider) {
    case "anthropic": return anthropicProvider(s.anthropicModel);
    case "openai": return openaiProvider(s.openaiModel);
    default: return ollamaProvider(s.ollamaModel);
  }
}
