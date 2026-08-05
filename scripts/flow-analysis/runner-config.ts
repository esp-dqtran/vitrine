import { join } from "node:path";

export const FLOW_ANALYSIS_PROVIDERS = [
  "chatgpt",
  "gemini",
] as const;

export type FlowAnalysisProvider = typeof FLOW_ANALYSIS_PROVIDERS[number];

const CHATGPT_DISABLED_MESSAGE =
  "ChatGPT flow analysis is disabled; use the Kiro CLI flow analyzer";

function rejectDisabledChatGpt(values: readonly string[]): void {
  if (values.includes("chatgpt")) throw new Error(CHATGPT_DISABLED_MESSAGE);
}

function providers(
  environment: Record<string, string | undefined>,
): FlowAnalysisProvider[] {
  const configured = environment.FLOW_ANALYSIS_PROVIDERS?.trim();
  const values = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [environment.FLOW_ANALYSIS_PROVIDER?.trim() || "chatgpt"];
  const unique = [...new Set(values)];
  if (
    unique.length === 0
    || unique.some((provider) => !FLOW_ANALYSIS_PROVIDERS.includes(
      provider as FlowAnalysisProvider,
    ))
  ) {
    throw new Error("Invalid FLOW_ANALYSIS_PROVIDERS");
  }
  rejectDisabledChatGpt(unique);
  return unique as FlowAnalysisProvider[];
}

function reanalyzeProviders(
  environment: Record<string, string | undefined>,
): FlowAnalysisProvider[] {
  const configured = environment.FLOW_REANALYZE_PROVIDERS?.trim();
  if (!configured) return [];
  const unique = [...new Set(
    configured.split(",").map((value) => value.trim()).filter(Boolean),
  )];
  if (
    unique.length === 0
    || unique.some((provider) => !FLOW_ANALYSIS_PROVIDERS.includes(
      provider as FlowAnalysisProvider,
    ))
  ) {
    throw new Error("Invalid FLOW_REANALYZE_PROVIDERS");
  }
  rejectDisabledChatGpt(unique);
  return unique as FlowAnalysisProvider[];
}

export function flowRunConfig(
  environment: Record<string, string | undefined>,
  cwd: string,
): {
  app: string;
  product: string;
  root: string;
  applicationName: string;
  providers: FlowAnalysisProvider[];
  reanalyzeProviders: FlowAnalysisProvider[];
} {
  const app = environment.FLOW_APP?.trim() || "1password";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) {
    throw new Error("Invalid FLOW_APP");
  }
  const product = environment.FLOW_PRODUCT?.trim() || (app === "1password" ? "1Password" : app);
  return {
    app,
    product,
    root: join(cwd, "data", "feature-descriptions", app),
    applicationName: `astryx-${app}-flow-feature-descriptions`,
    providers: providers(environment),
    reanalyzeProviders: reanalyzeProviders(environment),
  };
}
