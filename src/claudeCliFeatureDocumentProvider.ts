import type { FeatureDocumentProvider } from "./featureDocumentProvider.ts";
import {
  booleanSetting,
  createCliFeatureDocumentProvider,
  createKiroCliFeatureDocumentProvider,
  type KiroCliRunner,
  officialDocumentationDomains,
  positiveInteger,
  runKiroCli,
} from "./kiroCliFeatureDocumentProvider.ts";
import { resolve } from "node:path";

export interface ClaudeCliFeatureDocumentConfig {
  binary: string;
  model: string;
  providerModel: string;
  cwd: string;
  maxOutputBytes: number;
  officialDocumentationEnabled: boolean;
  officialDocumentationDomains: string[];
}

const FALSE_VALUES = new Set(["0", "false", "off", "no"]);

export function claudeCliFeatureDocumentConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ClaudeCliFeatureDocumentConfig | undefined {
  if (FALSE_VALUES.has(environment.CLAUDE_CLI_FEATURE_DOCUMENT_ENABLED?.trim().toLowerCase() ?? "")) {
    return undefined;
  }
  const model = environment.CLAUDE_CLI_FEATURE_DOCUMENT_MODEL?.trim() || "claude-sonnet-5";
  if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(model)) throw new Error("Invalid Claude CLI model");
  const domains = officialDocumentationDomains(
    environment.CLAUDE_CLI_FEATURE_DOCUMENT_OFFICIAL_DOMAINS,
  );
  const officialDocumentationEnabled = domains.length > 0 || booleanSetting(
    environment.CLAUDE_CLI_FEATURE_DOCUMENT_OFFICIAL_DOCUMENTATION,
  );
  return {
    binary: environment.CLAUDE_CLI_BIN?.trim() || "claude",
    model,
    providerModel: `claude-cli:${model}${officialDocumentationEnabled ? "+official-docs" : ""}`,
    cwd: resolve(environment.CLAUDE_CLI_FEATURE_DOCUMENT_CWD?.trim() || process.cwd()),
    maxOutputBytes: positiveInteger(
      environment.CLAUDE_CLI_FEATURE_DOCUMENT_MAX_OUTPUT_BYTES,
      4_000_000,
    ),
    officialDocumentationEnabled,
    officialDocumentationDomains: domains,
  };
}

export function createClaudeCliFeatureDocumentProvider(
  environment: NodeJS.ProcessEnv = process.env,
  runner: KiroCliRunner = runKiroCli,
): FeatureDocumentProvider | undefined {
  const config = claudeCliFeatureDocumentConfigFromEnvironment(environment);
  if (!config) return undefined;
  return createCliFeatureDocumentProvider({
    providerModel: config.providerModel,
    binary: config.binary,
    cwd: config.cwd,
    maxOutputBytes: config.maxOutputBytes,
    officialDocumentationEnabled: config.officialDocumentationEnabled,
    officialDocumentationDomains: config.officialDocumentationDomains,
    readTool: "the Read tool",
    label: "Claude CLI",
    argumentsFor: (prompt, capabilities) => {
      const tools = [
        ...(capabilities.readImages ? ["Read"] : []),
        ...(capabilities.webSearch ? ["WebSearch"] : []),
      ];
      // "--" is required: --allowedTools is variadic and would swallow the prompt.
      return [
        "--print",
        "--output-format",
        "text",
        "--model",
        config.model,
        ...(tools.length ? ["--allowedTools", tools.join(",")] : []),
        "--",
        prompt,
      ];
    },
  }, runner);
}

export function createFeatureDocumentProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  runner: KiroCliRunner = runKiroCli,
): FeatureDocumentProvider | undefined {
  const selected = environment.FEATURE_DOCUMENT_PROVIDER?.trim().toLowerCase() || "kiro";
  if (selected === "claude") return createClaudeCliFeatureDocumentProvider(environment, runner);
  if (selected === "kiro") return createKiroCliFeatureDocumentProvider(environment, runner);
  throw new Error("FEATURE_DOCUMENT_PROVIDER must be kiro or claude");
}
