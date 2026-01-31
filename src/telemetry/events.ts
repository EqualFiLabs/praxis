export type TelemetryEventType =
  | "plan"
  | "validate"
  | "execute"
  | "persist"
  | "error";

export type TelemetryEvent = {
  type: TelemetryEventType;
  timestamp: string;
  agentId: string;
  sessionId?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
};

export type TelemetryLogger = {
  log: (event: TelemetryEvent) => Promise<void>;
};
