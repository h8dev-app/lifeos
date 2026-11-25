/**
 * API keys: write-only from TypeScript. There is no command to read a key;
 * Rust adds it to requests itself (`secure_fetch`).
 */
import { invoke } from "@tauri-apps/api/core";

export type SecretName = "anthropic_api_key" | "openai_api_key" | "github_token";

export const setSecret = (name: SecretName, value: string) => invoke<void>("secret_set", { name, value });
export const deleteSecret = (name: SecretName) => invoke<void>("secret_delete", { name });
export const secretExists = (name: SecretName) => invoke<boolean>("secret_exists", { name });

export interface FetchResponse {
  status: number;
  body: string;
}

/** HTTPS call through Rust, which adds the key `secretName` from the keyring. */
export function secureFetch(
  url: string,
  method: "GET" | "POST",
  body: unknown,
  secretName: SecretName | null,
): Promise<FetchResponse> {
  return invoke<FetchResponse>("secure_fetch", {
    url,
    method,
    body: body === undefined ? null : JSON.stringify(body),
    secretName,
  });
}
