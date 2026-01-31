import { z } from "zod";

export type Session = {
  sessionId: string;
  agentId: string;
  chainId: number;
  createdAt: number;
  updatedAt: number;
  sessionKey?: string;
};

export type SessionSummary = {
  sessionId: string;
  updatedAt: number;
};

export type SessionsFile = Record<
  string,
  {
    sessionId: string;
    agentId: string;
    updatedAt: number;
    lastChain: number;
  }
>;

export type TranscriptEntry = {
  type: "message" | "action" | "error" | "system";
  role?: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
  metadata?: {
    selector?: string;
    txHash?: string;
    error?: string;
    [key: string]: unknown;
  };
};

export const SessionRecordSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  updatedAt: z.number(),
  lastChain: z.number()
});

export const SessionsFileSchema = z.record(SessionRecordSchema);
