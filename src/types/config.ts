import { z } from "zod";

export type ProviderType = "ollama" | "external";

export type InferenceConfig = {
  provider: ProviderType;
  fallbackProvider?: string;
  privacy: {
    allowExternal: boolean;
    allowSensitiveMemory: boolean;
  };
};

export type ProviderAdapter = {
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
};

export type ProviderConfig = {
  type: ProviderType;
  baseUrl: string;
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  timeoutMs: number;
  apiKeyEnv?: string;
  adapters?: {
    anthropic?: ProviderAdapter;
    google?: ProviderAdapter;
  };
};

export type ChannelsConfig = {
  telegram?: {
    enabled: boolean;
    botTokenEnv: string;
    webhookUrl?: string;
    polling?: boolean;
    apiBaseUrl?: string;
    allowFrom?: string[];
    accounts?: Record<
      string,
      {
        enabled?: boolean;
        botTokenEnv: string;
        webhookUrl?: string;
        polling?: boolean;
        apiBaseUrl?: string;
        allowFrom?: string[];
      }
    >;
    defaultAccountId?: string;
  };
  whatsapp?: {
    enabled: boolean;
    sessionDir: string;
    provider?: "cloud" | "web";
    apiBaseUrl?: string;
    allowFrom?: string[];
    accounts?: Record<
      string,
      {
        enabled?: boolean;
        sessionDir: string;
        provider?: "cloud" | "web";
        apiBaseUrl?: string;
        allowFrom?: string[];
      }
    >;
    defaultAccountId?: string;
  };
  discord?: {
    enabled: boolean;
    botTokenEnv: string;
    appId?: string;
    publicKeyEnv?: string;
    apiBaseUrl?: string;
    allowFrom?: string[];
    accounts?: Record<
      string,
      {
        enabled?: boolean;
        botTokenEnv: string;
        appId?: string;
        publicKeyEnv?: string;
        apiBaseUrl?: string;
        allowFrom?: string[];
      }
    >;
    defaultAccountId?: string;
  };
};

export type AgentConfig = {
  agent: {
    id: string;
    profile: string;
  };
  auth: {
    ownerKeyEnv: string;
  };
  inference: InferenceConfig;
  providers: {
    ollama?: ProviderConfig;
    external?: ProviderConfig;
  };
  chain: {
    rpcUrl: string;
    chainId: number;
    tbaAddress: string;
    positionNftAddress: string;
    positionTokenId: string;
  };
  channels?: ChannelsConfig;
};

export const ProviderAdapterSchema = z.object({
  baseUrl: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  model: z.string().min(1)
});

export const ProviderConfigSchema = z.object({
  type: z.enum(["ollama", "external"]),
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  apiKeyEnv: z.string().optional(),
  adapters: z
    .object({
      anthropic: ProviderAdapterSchema.optional(),
      google: ProviderAdapterSchema.optional()
    })
    .optional()
});

export const InferenceConfigSchema = z.object({
  provider: z.enum(["ollama", "external"]),
  fallbackProvider: z.string().optional(),
  privacy: z.object({
    allowExternal: z.boolean(),
    allowSensitiveMemory: z.boolean()
  })
});

export const ChannelsConfigSchema = z
  .object({
    telegram: z
      .object({
        enabled: z.boolean(),
        botTokenEnv: z.string().min(1),
        webhookUrl: z.string().min(1).optional(),
        polling: z.boolean().optional(),
        apiBaseUrl: z.string().min(1).optional(),
        allowFrom: z.array(z.string()).optional(),
        accounts: z
          .record(
            z.object({
              enabled: z.boolean().optional(),
              botTokenEnv: z.string().min(1),
              webhookUrl: z.string().min(1).optional(),
              polling: z.boolean().optional(),
              apiBaseUrl: z.string().min(1).optional(),
              allowFrom: z.array(z.string()).optional()
            })
          )
          .optional(),
        defaultAccountId: z.string().min(1).optional()
      })
      .optional(),
    whatsapp: z
      .object({
        enabled: z.boolean(),
        sessionDir: z.string().min(1),
        provider: z.enum(["cloud", "web"]).optional(),
        apiBaseUrl: z.string().min(1).optional(),
        allowFrom: z.array(z.string()).optional(),
        accounts: z
          .record(
            z.object({
              enabled: z.boolean().optional(),
              sessionDir: z.string().min(1),
              provider: z.enum(["cloud", "web"]).optional(),
              apiBaseUrl: z.string().min(1).optional(),
              allowFrom: z.array(z.string()).optional()
            })
          )
          .optional(),
        defaultAccountId: z.string().min(1).optional()
      })
      .optional(),
    discord: z
      .object({
        enabled: z.boolean(),
        botTokenEnv: z.string().min(1),
        appId: z.string().min(1).optional(),
        publicKeyEnv: z.string().min(1).optional(),
        apiBaseUrl: z.string().min(1).optional(),
        allowFrom: z.array(z.string()).optional(),
        accounts: z
          .record(
            z.object({
              enabled: z.boolean().optional(),
              botTokenEnv: z.string().min(1),
              appId: z.string().min(1).optional(),
              publicKeyEnv: z.string().min(1).optional(),
              apiBaseUrl: z.string().min(1).optional(),
              allowFrom: z.array(z.string()).optional()
            })
          )
          .optional(),
        defaultAccountId: z.string().min(1).optional()
      })
      .optional()
  })
  .optional();

export const AgentConfigSchema = z.object({
  agent: z.object({
    id: z.string().min(1),
    profile: z.string().min(1)
  }),
  auth: z.object({
    ownerKeyEnv: z.string().min(1)
  }),
  inference: InferenceConfigSchema,
  providers: z.object({
    ollama: ProviderConfigSchema.optional(),
    external: ProviderConfigSchema.optional()
  }),
  chain: z.object({
    rpcUrl: z.string().min(1),
    chainId: z.number().int().positive(),
    tbaAddress: z.string().min(1),
    positionNftAddress: z.string().min(1),
    positionTokenId: z.string().min(1)
  }),
  channels: ChannelsConfigSchema
});
