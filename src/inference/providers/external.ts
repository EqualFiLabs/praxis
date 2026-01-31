import type { ChatMessage } from "../manager";
import type { ProviderConfig } from "../../types/config";
import { ProviderError } from "../../errors";

export type ExternalAdapter = "anthropic" | "google";

export type ChatResponse = {
  content: string;
  raw: unknown;
};

function resolveExternalConfig(
  config: ProviderConfig,
  adapter?: ExternalAdapter
): { baseUrl: string; apiKey: string; model: string } {
  const base = config.baseUrl.replace(/\/$/, "");
  let baseUrl = base;
  let apiKeyEnv = config.apiKeyEnv;
  let model = config.model;

  if (adapter && config.adapters && config.adapters[adapter]) {
    const override = config.adapters[adapter]!;
    baseUrl = override.baseUrl.replace(/\/$/, "");
    apiKeyEnv = override.apiKeyEnv;
    model = override.model;
  }

  if (!apiKeyEnv) {
    throw new ProviderError("Missing API key environment variable");
  }
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new ProviderError(`Missing API key value for ${apiKeyEnv}`);
  }

  return { baseUrl, apiKey, model };
}

function withTimeout(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true }
  );
  return controller.signal;
}

export async function chatExternal(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: { adapter?: ExternalAdapter; timeoutMs?: number }
): Promise<ChatResponse> {
  const { baseUrl, apiKey, model } = resolveExternalConfig(config, opts?.adapter);
  const timeoutMs = opts?.timeoutMs ?? config.timeoutMs ?? 60_000;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages
    }),
    signal: withTimeout(timeoutMs)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ProviderError(`External inference error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  return { content, raw: json };
}
