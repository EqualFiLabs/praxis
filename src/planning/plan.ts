import type { AgentContext, AgentInput } from "../agent/loop";
import type { ActionPlan } from "../types/execution";
import { ActionPlanSchema } from "../types/execution";
import type { InferenceConfigInput, ProviderSelection } from "../inference/manager";
import {
  buildSafePrompt,
  selectProviderWithProbe,
  type ChatMessage
} from "../inference/manager";
import { chatOllama } from "../inference/providers/ollama";
import { chatExternal } from "../inference/providers/external";
import type { TaggedContent } from "../safety/content";
import { buildPlanningMessages } from "./prompt";

export type PlanningResult = {
  plan: ActionPlan;
  selectors: string[];
  raw: string;
};

export async function planWithInference(params: {
  context: AgentContext;
  input: AgentInput;
  inference: InferenceConfigInput;
  externalContent?: TaggedContent[];
  allowSources?: string[];
}): Promise<PlanningResult> {
  const messages = buildPlanningMessages(params.context, params.input);
  const prompt = buildSafePrompt(messages, params.externalContent ?? [], {
    allowSources: params.allowSources
  });
  const selection = await selectProviderWithProbe(params.inference);
  const response = await chatWithProvider(selection, prompt);
  const plan = parseActionPlan(response.content);
  return {
    plan,
    selectors: extractSelectors(plan),
    raw: response.content
  };
}

export function parseActionPlan(raw: string): ActionPlan {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as unknown;
  return ActionPlanSchema.parse(parsed);
}

export function extractSelectors(plan: ActionPlan): string[] {
  return plan.actions.map((action) => action.selector);
}

async function chatWithProvider(
  selection: ProviderSelection,
  messages: ChatMessage[]
): Promise<{ content: string }> {
  if (selection.id === "ollama") {
    return chatOllama(selection.config, messages);
  }
  return chatExternal(selection.config, messages);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const inline = raw.match(/```([\s\S]*?)```/);
  if (inline?.[1]) {
    return inline[1].trim();
  }
  return raw.trim();
}
