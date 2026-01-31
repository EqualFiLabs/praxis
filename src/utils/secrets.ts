const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function isEnvVarName(value: string): boolean {
  return ENV_NAME_PATTERN.test(value);
}

export function assertEnvVarName(value: string, label = "env var"): void {
  if (!isEnvVarName(value)) {
    throw new Error(`${label} must be an environment variable name`);
  }
}

export function resolveSecretFromEnv(envVarName: string, label = "secret"): string {
  assertEnvVarName(envVarName, `${label} env var`);
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`${label} not found in environment: ${envVarName}`);
  }
  return value;
}

export function redactSecret(value: string, visible = 4): string {
  if (!value) {
    return "";
  }
  if (value.length <= visible * 2) {
    return "*".repeat(value.length);
  }
  const start = value.slice(0, visible);
  const end = value.slice(-visible);
  return `${start}...${end}`;
}
