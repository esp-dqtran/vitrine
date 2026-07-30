import assert from "node:assert/strict";
import test from "node:test";
import { flowRunConfig } from "./runner-config.ts";

test("disables the legacy default ChatGPT flow analyzer", () => {
  assert.throws(
    () => flowRunConfig({}, "/workspace"),
    /ChatGPT flow analysis is disabled; use the Kiro CLI flow analyzer/,
  );
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

test("selects the remaining browser providers for distributed Flow analysis", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_APP: "stripe",
      FLOW_PRODUCT: "Stripe",
      FLOW_ANALYSIS_PROVIDERS: "antigravity, gemini",
    }, "/workspace"),
    {
      app: "stripe",
      product: "Stripe",
      root: "/workspace/data/feature-descriptions/stripe",
      applicationName: "astryx-stripe-flow-feature-descriptions",
      providers: ["antigravity", "gemini"],
      reanalyzeProviders: [],
    },
  );
});

test("selects saved provider outputs to replace without changing the active provider", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini",
      FLOW_REANALYZE_PROVIDERS: "antigravity,antigravity",
    }, "/workspace"),
    {
      app: "1password",
      product: "1Password",
      root: "/workspace/data/feature-descriptions/1password",
      applicationName: "astryx-1password-flow-feature-descriptions",
      providers: ["gemini"],
      reanalyzeProviders: ["antigravity"],
    },
  );
});

test("deduplicates providers while preserving their configured order", () => {
  assert.deepEqual(
    flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini,antigravity,gemini",
    }, "/workspace").providers,
    ["gemini", "antigravity"],
  );
});

test("rejects ChatGPT for new and replacement flow analysis", () => {
  assert.throws(
    () => flowRunConfig({ FLOW_ANALYSIS_PROVIDER: "chatgpt" }, "/workspace"),
    /ChatGPT flow analysis is disabled; use the Kiro CLI flow analyzer/,
  );
  assert.throws(
    () => flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini,chatgpt",
    }, "/workspace"),
    /ChatGPT flow analysis is disabled; use the Kiro CLI flow analyzer/,
  );
  assert.throws(
    () => flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini",
      FLOW_REANALYZE_PROVIDERS: "chatgpt",
    }, "/workspace"),
    /ChatGPT flow analysis is disabled; use the Kiro CLI flow analyzer/,
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
    () => flowRunConfig({
      FLOW_ANALYSIS_PROVIDERS: "gemini",
      FLOW_REANALYZE_PROVIDERS: "gemini,unknown",
    }, "/workspace"),
    /Invalid FLOW_REANALYZE_PROVIDERS/,
  );
});
