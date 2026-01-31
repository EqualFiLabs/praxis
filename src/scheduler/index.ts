import { promises as fs } from "node:fs";
import path from "node:path";

import { getAgentBasePath } from "../config/loader";
import { resolveSafePath } from "../utils/path-security";

export type ScheduledJob = {
  id: string;
  agentId: string;
  runAt: number;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
};

export type JobHandler = (job: ScheduledJob) => Promise<void>;

const JOBS_FILE = "jobs.json";

export async function schedule(job: ScheduledJob): Promise<void> {
  const jobs = await loadJobs(job.agentId);
  jobs.push(job);
  await saveJobs(job.agentId, jobs);
}

export async function runDueJobs(
  agentId: string,
  handler: JobHandler,
  now = Date.now()
): Promise<{ ran: number; failed: number }> {
  const jobs = await loadJobs(agentId);
  let ran = 0;
  let failed = 0;
  const remaining: ScheduledJob[] = [];

  for (const job of jobs) {
    if (job.runAt > now) {
      remaining.push(job);
      continue;
    }
    try {
      await handler(job);
      ran += 1;
    } catch {
      failed += 1;
      const nextAttempts = job.attempts + 1;
      if (nextAttempts < job.maxAttempts) {
        remaining.push({ ...job, attempts: nextAttempts, runAt: now + 60_000 });
      }
    }
  }

  await saveJobs(agentId, remaining);
  return { ran, failed };
}

export function startScheduler(
  agentId: string,
  handler: JobHandler,
  intervalMs = 60_000
): { stop: () => void } {
  const timer = setInterval(() => {
    void runDueJobs(agentId, handler);
  }, intervalMs);
  return {
    stop: () => clearInterval(timer)
  };
}

async function loadJobs(agentId: string): Promise<ScheduledJob[]> {
  const file = getJobsPath(agentId);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as ScheduledJob[];
  } catch {
    return [];
  }
}

async function saveJobs(agentId: string, jobs: ScheduledJob[]): Promise<void> {
  const file = getJobsPath(agentId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(jobs, null, 2), "utf8");
}

function getJobsPath(agentId: string): string {
  const base = getAgentBasePath(agentId);
  return resolveSafePath(base, JOBS_FILE);
}
