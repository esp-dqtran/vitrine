import { test } from "node:test";
import assert from "node:assert/strict";
import * as crawlPlan from "./crawlPlan.ts";

const { parseCrawlPlan, parseCrawlSteps, resolveStepUrl, resolveValue } = crawlPlan;

const ready = { state: "Ready", visible: { text: "Ready" } };

const validPlan = {
  app: "atlassian",
  revision: 1,
  startUrl: "https://www.atlassian.com",
  domain: "Team collaboration and developer tools.",
  sources: ["https://www.atlassian.com/software/jira"],
  reviewed: false,
  flows: [
    {
      id: "browse-products",
      title: "Browse products",
      description: "Open Jira from the catalog.",
      safe: true,
      requiredSecrets: [],
      steps: [
        {
          id: "open-software",
          action: "goto",
          url: "/software",
          safety: "read",
          expected: {
            state: "Software catalog",
            url: "https://www.atlassian.com/software",
            visible: { text: "Explore Atlassian products" },
          },
        },
      ],
    },
  ],
};

function makeStep(action: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const actionFields =
    action === "goto"
      ? { url: "/x" }
      : action === "press"
        ? { key: "Enter" }
        : action === "fill"
          ? { text: "Field", value: "ordinary text" }
          : { text: "Continue" };
  return { id: `${action}-step`, action, ...actionFields, safety: "read", expected: ready, ...extra };
}

const flow = (steps: unknown[], extra: Record<string, unknown> = {}) => ({
  id: "f1",
  title: "Flow",
  description: "",
  safe: true,
  requiredSecrets: [],
  steps,
  ...extra,
});

function withFlows(flows: unknown[]): string {
  return JSON.stringify({ ...validPlan, flows });
}

test("parses the revisioned observable plan contract", () => {
  const plan = parseCrawlPlan(JSON.stringify(validPlan));
  assert.equal(plan.app, "atlassian");
  assert.equal(plan.revision, 1);
  assert.equal(plan.reviewed, false);
  assert.deepEqual(plan.flows[0].requiredSecrets, []);
  assert.deepEqual(plan.flows[0].steps[0], validPlan.flows[0].steps[0]);
});

test("requires a positive integer revision and stable unique step ids", () => {
  for (const revision of [undefined, 0, -1, 1.5, "1"]) {
    assert.throws(() => parseCrawlPlan(JSON.stringify({ ...validPlan, revision })), /revision.*positive integer/);
  }
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { id: "" })])])), /id.*non-empty/);
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { id: "same" }), makeStep("press", { id: "same" })])])),
    /Duplicate step id same/
  );
});

test("requires a labelled expected state with an observable assertion", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { expected: undefined })])])), /expected.*object/);
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { expected: { state: "", visible: { text: "Ready" } } })])])),
    /expected\.state.*non-empty/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { expected: { state: "Popup", page: "new" } })])])),
    /observable assertion/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { expected: { state: "Bad", page: "other", url: "https://x.test" } })])])),
    /expected\.page.*same or new/
  );
});

test("validates exact URLs, wildcard URL patterns, and expectation locators", () => {
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("goto", { expected: { state: "Bad", urlPattern: "not an absolute url/*" } })])])),
    /urlPattern.*absolute URL pattern/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("goto", { expected: { state: "Bad", url: "/relative" } })])])),
    /expected\.url.*absolute URL/
  );
  assert.throws(
    () =>
      parseCrawlPlan(
        withFlows([
          flow([
            makeStep("click", {
              expected: { state: "Bad", visible: { text: "Ready", css: ".ready" } },
              locatorReason: "Fallback selector",
            }),
          ]),
        ])
      ),
    /expected\.visible.*exactly one locator/
  );
});

test("rejects unknown actions and invalid step safety", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("hover")])])), /"hover" is not one of/);
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { safety: "maybe" })])])), /safety.*read or side-effect/);
});

test("rejects steps with zero, partial, or multiple action locators", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { text: undefined })])])), /exactly one locator/);
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { text: "Save", css: ".save", locatorReason: "Fallback" })])])),
    /exactly one locator/
  );
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { text: undefined, role: "button" })])])), /name/);
});

test("rejects locators on goto and press, and requires their own fields", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("goto", { text: "y" })])])), /must not have a locator/);
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("goto", { url: undefined })])])), /url/);
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("press", { key: undefined })])])), /key/);
});

test("requires a reason for every CSS locator", () => {
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { text: undefined, css: ".continue" })])])),
    /locatorReason/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { expected: { state: "Gone", hidden: { css: ".spinner" } } })])])),
    /locatorReason/
  );
  const parsed = parseCrawlPlan(
    withFlows([
      flow([
        makeStep("click", {
          text: undefined,
          css: ".continue",
          locatorReason: "No accessible label",
          expected: { state: "Gone", hidden: { css: ".spinner" } },
        }),
      ]),
    ])
  );
  assert.equal(parsed.flows[0].steps[0].locatorReason, "No accessible label");
});

test("requires optionalReason exactly when optional is true", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("click", { optional: true })])])), /optionalReason/);
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { optionalReason: "May be absent" })])])),
    /optionalReason.*optional.*true/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { optional: false, optionalReason: "May be absent" })])])),
    /optionalReason.*optional.*true/
  );
  const parsed = parseCrawlPlan(
    withFlows([flow([makeStep("click", { optional: true, optionalReason: "Cookie banner varies by region" })])])
  );
  assert.equal(parsed.flows[0].steps[0].optionalReason, "Cookie banner varies by region");
});

test("forbids side-effect steps in safe flows", () => {
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("click", { safety: "side-effect" })])])),
    /side-effect.*safe flow/
  );
  const parsed = parseCrawlPlan(
    withFlows([flow([makeStep("click", { safety: "side-effect" })], { safe: false })])
  );
  assert.equal(parsed.flows[0].steps[0].safety, "side-effect");
});

test("requires fill values and boolean flags", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([makeStep("fill", { value: undefined })])])), /value/);
  assert.throws(() => parseCrawlPlan(withFlows([flow([], { safe: "yes" })])), /safe must be true or false/);
  assert.throws(() => parseCrawlPlan(JSON.stringify({ ...validPlan, reviewed: undefined })), /reviewed must be true or false/);
});

test("requires unique valid secret names that exactly cover fill references", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([], { requiredSecrets: undefined })])), /requiredSecrets.*array/);
  assert.throws(() => parseCrawlPlan(withFlows([flow([], { requiredSecrets: ["TOKEN", "TOKEN"] })])), /Duplicate required secret TOKEN/);
  for (const name of ["$TOKEN", "token", "1TOKEN", "TOKEN-NAME"]) {
    assert.throws(() => parseCrawlPlan(withFlows([flow([], { requiredSecrets: [name] })])), /requiredSecrets.*valid secret name/);
  }
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("fill", { value: "$TEST_EMAIL" })])])),
    /requiredSecrets.*TEST_EMAIL/
  );
  assert.throws(
    () => parseCrawlPlan(withFlows([flow([makeStep("fill")], { requiredSecrets: ["UNUSED"] })])),
    /requiredSecrets.*UNUSED/
  );
  const parsed = parseCrawlPlan(
    withFlows([flow([makeStep("fill", { value: "$TEST_EMAIL" })], { requiredSecrets: ["TEST_EMAIL"] })])
  );
  assert.deepEqual(parsed.flows[0].requiredSecrets, ["TEST_EMAIL"]);
});

test("rejects malformed secret references and secret-looking fill literals", () => {
  for (const value of ["$test", "$TEST-NAME", "qa@example.com", "password123", "Bearer abc.def.ghi", "-----BEGIN PRIVATE KEY-----"]) {
    assert.throws(
      () => parseCrawlPlan(withFlows([flow([makeStep("fill", { value })])])),
      (error: unknown) => error instanceof Error && !error.message.includes(value) && /secret|credential|reference/i.test(error.message)
    );
  }
  const parsed = parseCrawlPlan(withFlows([flow([makeStep("fill", { value: "Quarterly roadmap" })])]));
  assert.equal(parsed.flows[0].steps[0].value, "Quarterly roadmap");
});

test("rejects duplicate flow ids and structural problems", () => {
  assert.throws(() => parseCrawlPlan(withFlows([flow([]), flow([])])), /Duplicate flow id f1/);
  assert.throws(() => parseCrawlPlan("not json"), /not valid JSON/);
  assert.throws(() => parseCrawlPlan(JSON.stringify({ ...validPlan, flows: [] })), /non-empty array/);
  assert.throws(() => parseCrawlPlan(JSON.stringify({ ...validPlan, startUrl: "/relative" })), /Invalid URL/);
});

test("matches exact and safely escaped wildcard URL expectations", () => {
  const matcher = (crawlPlan as typeof crawlPlan & {
    urlMatchesExpectation(actual: string, expected: { url?: string; urlPattern?: string }): boolean;
  }).urlMatchesExpectation;
  assert.equal(typeof matcher, "function");
  assert.equal(matcher("https://example.com/a", { url: "https://example.com/a" }), true);
  assert.equal(matcher("https://example.com/b", { url: "https://example.com/a" }), false);
  assert.equal(matcher("https://example.com/products/42", { urlPattern: "https://example.com/products/*" }), true);
  assert.equal(matcher("https://exampleXcom/fileX.txt", { urlPattern: "https://example.com/file?.txt" }), false);
  assert.equal(matcher("https://example.com/file?.txt", { urlPattern: "https://example.com/file?.txt" }), true);
  assert.equal(matcher("https://example.com/admin", { urlPattern: "https://example.com/(admin|public)" }), false);
  assert.equal(matcher("https://example.com/(admin|public)", { urlPattern: "https://example.com/(admin|public)" }), true);
});

test("wildcard URL matcher remains bounded for adversarial repeated stars", () => {
  const matcher = (crawlPlan as typeof crawlPlan & {
    urlMatchesExpectation(actual: string, expected: { urlPattern: string }): boolean;
  }).urlMatchesExpectation;
  const repetitions = 9;
  const pattern = `https://example.test/${"*a".repeat(repetitions)}*b`;
  const actual = `https://example.test/${"a".repeat(repetitions * 3)}c`;
  const started = performance.now();
  assert.equal(matcher(actual, { urlPattern: pattern }), false);
  assert.ok(performance.now() - started < 100, "adversarial glob must complete in bounded time");
  assert.equal(matcher("https://example.test/a/anything/b", { urlPattern: "https://example.test/a/***/b" }), true);
});

test("resolves only exact $NAME references without leaking values", () => {
  assert.equal(resolveValue("$TEST_EMAIL", { TEST_EMAIL: "qa@example.com" }), "qa@example.com");
  assert.equal(resolveValue("plain text", {}), "plain text");
  assert.throws(() => resolveValue("$lower", { lower: "do-not-leak" }), (error: unknown) => {
    return error instanceof Error && /exact.*secret reference/i.test(error.message) && !error.message.includes("do-not-leak");
  });
  assert.throws(() => resolveValue("$MISSING", { OTHER: "do-not-leak" }), (error: unknown) => {
    return error instanceof Error && /\$MISSING/.test(error.message) && !error.message.includes("do-not-leak");
  });
});

test("resolves step urls against startUrl", () => {
  assert.equal(resolveStepUrl("https://www.atlassian.com", "/software"), "https://www.atlassian.com/software");
  assert.equal(resolveStepUrl("https://www.atlassian.com", "https://id.atlassian.com/login"), "https://id.atlassian.com/login");
});

test("parses one to five bounded autonomous episode steps", () => {
  assert.equal(parseCrawlSteps([makeStep("click")]).length, 1);
  assert.throws(() => parseCrawlSteps([]), /one to five/);
  assert.throws(() => parseCrawlSteps(Array.from({ length: 6 }, (_, index) => makeStep("click", { id: `step-${index}` }))), /one to five/);
  assert.throws(() => parseCrawlSteps([makeStep("click", { id: "same" }), makeStep("click", { id: "same" })]), /Duplicate step id same/);
});
