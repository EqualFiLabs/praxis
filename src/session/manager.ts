import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { getAgentBasePath } from "../config/loader";
import type { SessionKey } from "./identity";
import type { Session, SessionSummary, SessionsFile } from "../types/session";
import { SessionsFileSchema } from "../types/session";

const SESSIONS_FILENAME = "sessions.json";

function getSessionsPath(agentId: string): string {
  return path.join(getAgentBasePath(agentId), SESSIONS_FILENAME);
}

async function loadSessionsFile(agentId: string): Promise<SessionsFile> {
  const sessionsPath = getSessionsPath(agentId);
  try {
    const raw = await fs.readFile(sessionsPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return SessionsFileSchema.parse(parsed);
  } catch {
    return {};
  }
}

async function saveSessionsFile(agentId: string, file: SessionsFile): Promise<void> {
  const sessionsPath = getSessionsPath(agentId);
  await fs.mkdir(path.dirname(sessionsPath), { recursive: true });
  await fs.writeFile(sessionsPath, JSON.stringify(file, null, 2), "utf-8");
}

function newSessionId(): string {
  return crypto.randomUUID();
}

export async function getOrCreateSession(
  agentId: string,
  sessionKey: SessionKey = "main"
): Promise<Session> {
  const sessions = await loadSessionsFile(agentId);
  const existing = sessions[sessionKey];
  if (existing) {
    return {
      sessionId: existing.sessionId,
      agentId: existing.agentId,
      chainId: existing.lastChain,
      createdAt: existing.updatedAt,
      updatedAt: existing.updatedAt,
      sessionKey
    };
  }

  const now = Date.now();
  const sessionId = newSessionId();
  const session: Session = {
    sessionId,
    agentId,
    chainId: 0,
    createdAt: now,
    updatedAt: now,
    sessionKey
  };
  sessions[sessionKey] = {
    sessionId,
    agentId,
    updatedAt: now,
    lastChain: 0
  };
  await saveSessionsFile(agentId, sessions);
  return session;
}

export async function updateSession(session: Session & { sessionKey?: SessionKey }): Promise<void> {
  const sessions = await loadSessionsFile(session.agentId);
  const now = Date.now();
  const key = session.sessionKey ?? "main";
  const existing = sessions[key] ?? {
    sessionId: session.sessionId,
    agentId: session.agentId,
    updatedAt: now,
    lastChain: session.chainId
  };
  sessions[key] = {
    ...existing,
    sessionId: session.sessionId,
    agentId: session.agentId,
    updatedAt: now,
    lastChain: session.chainId
  };
  await saveSessionsFile(session.agentId, sessions);
}

export async function listSessions(agentId: string): Promise<SessionSummary[]> {
  const sessions = await loadSessionsFile(agentId);
  return Object.values(sessions).map((entry) => ({
    sessionId: entry.sessionId,
    updatedAt: entry.updatedAt
  }));
}
