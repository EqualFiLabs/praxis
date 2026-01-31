import type { ChatMessage } from "../manager";
import type { ProviderConfig } from "../../types/config";
import { ProviderError } from "../../errors";

export type ChatResponse = {
  content: string;
  raw: unknown;
};

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

export async function chatOllama(
  config: ProviderConfig,
  messages: ChatMessage[],
  opts?: { timeoutMs?: number }
): Promise<ChatResponse> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const timeoutMs = opts?.timeoutMs ?? config.timeoutMs ?? 60_000;
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false
    }),
    signal: withTimeout(timeoutMs)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ProviderError(`Ollama error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { message?: { content?: string } };
  return {
    content: json.message?.content ?? "",
    raw: json
  };
}
