import assert from "node:assert/strict";
import test from "node:test";
import { flowRunConfig } from "./runner-config.ts";

test("defaults the flow analysis runner to the existing 1Password artifact layout", () => {
  assert.deepEqual(flowRunConfig({}, "/workspace"), {
    app: "1password",
    product: "1Password",
    root: "/workspace/data/feature-descriptions/1password",
    applicationName: "astryx-1password-flow-feature-descriptions",
    providers: ["chatgpt"],
    reanalyzeProviders: [],
  });
});

test("keeps the legacy single-provider option", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_APP: "binance",
      FLOW_PRODUCT: "Binance",
      FLOW_ANALYSIS_PROVIDER: "antigravity",
    }, "/workspace"),
    {
      app: "binance",
      product: "Binance",
      root: "/workspace/data/feature-descriptions/binance",
      applicationName: "astryx-binance-flow-feature-descriptions",
      providers: ["antigravity"],
      reanalyzeProviders: [],
    },
  );
});

test("selects all three providers for distributed Flow analysis", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_APP: "stripe",
      FLOW_PRODUCT: "Stripe",
      FLOW_ANALYSIS_PROVIDERS: "chatgpt, antigravity, gemini",
    }, "/workspace"),
    {
      app: "stripe",
      product: "Stripe",
      root: "/workspace/data/feature-descriptions/stripe",
      applicationName: "astryx-stripe-flow-feature-descriptions",
      providers: ["chatgpt", "antigravity", "gemini"],
      reanalyzeProviders: [],
    },
  );
});

test("selects saved provider outputs to replace without changing the active provider", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "chatgpt",
      FLOW_REANALYZE_PROVIDERS: "gemini, antigravity,gemini",
    }, "/workspace"),
    {
      app: "1password",
      product: "1Password",
      root: "/workspace/data/feature-descriptions/1password",
      applicationName: "astryx-1password-flow-feature-descriptions",
      providers: ["chatgpt"],
      reanalyzeProviders: ["gemini", "antigravity"],
    },
  );
});

test("deduplicates providers while preserving their configured order", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini,chatgpt,gemini",
    }, "/workspace").providers,
    ["gemini", "chatgpt"],
  );
});

test("rejects unsafe app directory names", () => {
  assert.throws(
    () => flowRunConfig({ FLOW_APP: "../outside" }, "/workspace"),
    /Invalid FLOW_APP/,
  );
});

test("rejects an unsupported flow analysis provider", () => {
  assert.throws(
    () => flowRunConfig({ FLOW_ANALYSIS_PROVIDER: "unknown" }, "/workspace"),
    /Invalid FLOW_ANALYSIS_PROVIDERS/,
  );
  assert.throws(
    () => flowRunConfig({ FLOW_ANALYSIS_PROVIDERS: "chatgpt,unknown" }, "/workspace"),
    /Invalid FLOW_ANALYSIS_PROVIDERS/,
  );
  assert.throws(
    () => flowRunConfig({ FLOW_REANALYZE_PROVIDERS: "gemini,unknown" }, "/workspace"),
    /Invalid FLOW_REANALYZE_PROVIDERS/,
  );
});
