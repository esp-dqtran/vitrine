import type { WappalyzerBrowserOptions } from "../../../src/wappalyzerBrowser.ts";

export function wappalyzerOptionsFromEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Omit<WappalyzerBrowserOptions, "ports"> | undefined {
  const extensionPath =
    environment.SITE_TECH_WAPPALYZER_EXTENSION_PATH?.trim();
  if (!extensionPath) return undefined;
  const rawTimeout = environment.SITE_TECH_WAPPALYZER_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout === undefined || rawTimeout === ""
    ? 20_000
    : Number(rawTimeout);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1_000 ||
    timeoutMs > 120_000
  ) {
    throw new Error("Invalid Wappalyzer timeout configuration");
  }
  return {
    extensionPath,
    timeoutMs,
    headless: environment.HEADLESS !== "false",
  };
}
