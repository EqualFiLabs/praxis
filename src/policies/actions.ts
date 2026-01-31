export type PolicyContext = {
  agentId: string;
  userId?: string;
  channelId?: string;
  chatType?: "dm" | "group" | "thread";
  sessionId?: string;
};

export type PolicyRule = {
  allow?: string[];
  deny?: string[];
  defaultAction?: "allow" | "deny";
};

export type ActionPolicy = {
  global?: PolicyRule;
  agents?: Record<string, PolicyRule>;
  channels?: Record<string, PolicyRule>;
  users?: Record<string, PolicyRule>;
  sessions?: Record<string, PolicyRule>;
  chatTypes?: Record<NonNullable<PolicyContext["chatType"]>, PolicyRule>;
};

export type PolicyDecision = {
  action: string;
  allowed: boolean;
  reason: string;
};

const DEFAULT_RULE: PolicyRule = { defaultAction: "allow" };

export function evaluatePolicy(
  action: string,
  context: PolicyContext,
  policy?: ActionPolicy
): PolicyDecision {
  const rules = collectRules(context, policy);
  for (const rule of rules) {
    if (!rule) continue;
    const decision = evaluateRule(action, rule);
    if (decision) {
      return decision;
    }
  }
  const fallback = policy?.global ?? DEFAULT_RULE;
  const allowed = (fallback.defaultAction ?? "allow") === "allow";
  return {
    action,
    allowed,
    reason: allowed ? "default-allow" : "default-deny"
  };
}

export function evaluateRule(action: string, rule: PolicyRule): PolicyDecision | null {
  if (rule.deny && rule.deny.includes(action)) {
    return { action, allowed: false, reason: "deny-list" };
  }
  if (rule.allow && rule.allow.length > 0) {
    if (rule.allow.includes(action)) {
      return { action, allowed: true, reason: "allow-list" };
    }
    return { action, allowed: false, reason: "not-in-allow-list" };
  }
  if (rule.defaultAction) {
    return {
      action,
      allowed: rule.defaultAction === "allow",
      reason: "default-rule"
    };
  }
  return null;
}

function collectRules(context: PolicyContext, policy?: ActionPolicy): PolicyRule[] {
  if (!policy) return [];
  const rules: PolicyRule[] = [];
  if (context.sessionId) {
    rules.push(policy.sessions?.[context.sessionId]);
  }
  if (context.userId) {
    rules.push(policy.users?.[context.userId]);
  }
  if (context.channelId) {
    rules.push(policy.channels?.[context.channelId]);
  }
  if (context.chatType) {
    rules.push(policy.chatTypes?.[context.chatType]);
  }
  rules.push(policy.agents?.[context.agentId]);
  rules.push(policy.global);
  return rules.filter(Boolean);
}
