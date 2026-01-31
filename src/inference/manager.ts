import type { InferenceConfig, ProviderConfig } from "../types/config";
import { filterSensitiveMemory } from "../memory/store";

export type ProviderId = "ollama" | "external";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderSelection = {
  id: ProviderId;
  config: ProviderConfig;
};

export type ProviderAvailability = {
  ollama?: boolean;
  external?: boolean;
};

export type InferenceConfigInput = {
  inference?: Partial<InferenceConfig>;
  providers: {
    ollama?: ProviderConfig;
    external?: ProviderConfig;
  };
};

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true }
  );
  return controller.signal;
}

export async function probeProvider(config: ProviderConfig): Promise<boolean> {
  const timeoutMs = Math.max(1, config.timeoutMs ?? 5_000);
  const signal = withTimeout(undefined, timeoutMs);
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const url = config.type === "ollama" ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
  try {
    const res = await fetch(url, { method: "GET", signal });
    return res.ok;
  } catch {
    return false;
  }
}

export function selectProvider(
  input: InferenceConfigInput,
  availability: ProviderAvailability
): ProviderSelection | null {
  const defaultProvider = input.inference?.provider ?? "ollama";
  const allowExternal = input.inference?.privacy?.allowExternal ?? false;
  const ollamaConfig = input.providers.ollama;
  const externalConfig = input.providers.external;

  const isOllamaReady = Boolean(availability.ollama && ollamaConfig);
  const isExternalReady = Boolean(availability.external && externalConfig && allowExternal);

  if (defaultProvider === "ollama") {
    if (isOllamaReady) return { id: "ollama", config: ollamaConfig! };
    if (isExternalReady) return { id: "external", config: externalConfig! };
    return null;
  }

  if (defaultProvider === "external") {
    if (isExternalReady) return { id: "external", config: externalConfig! };
    if (isOllamaReady) return { id: "ollama", config: ollamaConfig! };
    return null;
  }

  return null;
}

export async function selectProviderWithProbe(input: InferenceConfigInput): Promise<ProviderSelection> {
  const availability: ProviderAvailability = {
    ollama: input.providers.ollama ? await probeProvider(input.providers.ollama) : false,
    external: input.providers.external ? await probeProvider(input.providers.external) : false
  };
  const selection = selectProvider(input, availability);
  if (!selection) {
    throw new Error("NoProviderAvailableError");
  }
  return selection;
}

export function estimateTokenCount(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const content = msg.content ?? "";
    total += Math.ceil(content.length / 4);
    total += 4;
  }
  return total;
}

export function enforceContextLimit(
  messages: ChatMessage[],
  provider: ProviderConfig
): void {
  const estimated = estimateTokenCount(messages);
  if (estimated > provider.contextWindow) {
    throw new Error("ContextWindowExceededError");
  }
}

export function filterMemoryForInference(
  raw: string,
  allowSensitiveMemory: boolean
): string {
  return filterSensitiveMemory(raw, allowSensitiveMemory);
}
