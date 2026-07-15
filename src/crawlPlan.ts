// The crawl plan is the contract between research (which writes it), the human reviewer
// (who edits it and flips `reviewed`), and the runner (which executes it). Parsing is
// deliberately strict — a plan that fails here gets fixed in the JSON file, never
// "interpreted around" at run time.

type JsonObject = Record<string, unknown>;

export type CrawlAction = "goto" | "click" | "fill" | "press" | "waitFor";

export interface CrawlLocator {
  role?: string;
  name?: string;
  text?: string;
  css?: string;
}

export interface ExpectedState {
  state: string;
  url?: string;
  urlPattern?: string; // `*` wildcard only; all other regex syntax is literal
  page?: "same" | "new";
  visible?: CrawlLocator;
  hidden?: CrawlLocator;
}

// Exactly one of role+name / text / css identifies the element for click/fill/waitFor.
export interface CrawlStep extends CrawlLocator {
  id: string;
  action: CrawlAction;
  url?: string; // goto — absolute, or resolved against the plan's startUrl
  key?: string; // press
  value?: string; // fill — exact "$VAR" references resolve from env at run time
  optional?: boolean; // locator not found in time -> skip step instead of failing the flow
  optionalReason?: string;
  locatorReason?: string;
  safety: "read" | "side-effect";
  expected: ExpectedState;
}

export interface CrawlFlow {
  id: string;
  title: string;
  description: string;
  safe: boolean; // side-effect-free, reviewed by a human; unsafe flows need TEST_ACCOUNT=1
  requiredSecrets: string[];
  steps: CrawlStep[]; // empty = record mode (human drives, capture core watches)
}

export interface CrawlPlan {
  app: string;
  revision: number;
  startUrl: string;
  domain: string;
  sources: string[];
  reviewed: boolean; // the runner refuses the whole plan until a human flips this
  flows: CrawlFlow[];
}

const ACTIONS: ReadonlySet<string> = new Set(["goto", "click", "fill", "press", "waitFor"]);
const SECRET_NAME = /^[A-Z][A-Z0-9_]*$/;
const SECRET_REFERENCE = /^\$([A-Z][A-Z0-9_]*)$/;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const SECRET_LITERAL = /\bBearer\s+\S+|\b(?:password|passwd|pwd)\S*|-----BEGIN [^-]*PRIVATE KEY-----/i;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be true or false`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function locatorCount(raw: JsonObject): number {
  return [raw.role !== undefined || raw.name !== undefined, raw.text !== undefined, raw.css !== undefined].filter(Boolean).length;
}

function parseLocatorFields(raw: JsonObject, label: string): CrawlLocator {
  if (locatorCount(raw) !== 1) throw new Error(`${label} must have exactly one locator: role+name, text, or css`);
  if (raw.role !== undefined || raw.name !== undefined) {
    return { role: text(raw.role, `${label}.role`), name: text(raw.name, `${label}.name`) };
  }
  if (raw.text !== undefined) return { text: text(raw.text, `${label}.text`) };
  return { css: text(raw.css, `${label}.css`) };
}

function absoluteUrl(value: unknown, label: string, wildcard = false): string {
  const url = text(value, label);
  try {
    new URL(wildcard ? url.replace(/\*/g, "wildcard") : url);
  } catch {
    throw new Error(`${label} must be an absolute URL${wildcard ? " pattern" : ""}`);
  }
  return url;
}

function parseExpected(value: unknown, label: string): ExpectedState {
  const raw = object(value, label);
  const expected: ExpectedState = { state: text(raw.state, `${label}.state`) };
  if (raw.url !== undefined) expected.url = absoluteUrl(raw.url, `${label}.url`);
  if (raw.urlPattern !== undefined) expected.urlPattern = absoluteUrl(raw.urlPattern, `${label}.urlPattern`, true);
  if (raw.page !== undefined) {
    const page = text(raw.page, `${label}.page`);
    if (page !== "same" && page !== "new") throw new Error(`${label}.page must be same or new`);
    expected.page = page;
  }
  if (raw.visible !== undefined) expected.visible = parseLocatorFields(object(raw.visible, `${label}.visible`), `${label}.visible`);
  if (raw.hidden !== undefined) expected.hidden = parseLocatorFields(object(raw.hidden, `${label}.hidden`), `${label}.hidden`);
  if (!expected.url && !expected.urlPattern && !expected.visible && !expected.hidden) {
    throw new Error(`${label} must include an observable assertion: url, urlPattern, visible, or hidden`);
  }
  return expected;
}

function secretReference(value: string, label: string, raw: JsonObject): string | undefined {
  const match = SECRET_REFERENCE.exec(value);
  if (match) return match[1];
  if (value.startsWith("$")) throw new Error(`${label} must be an exact $NAME secret reference`);
  const target = [raw.name, raw.text, raw.css].filter((part): part is string => typeof part === "string").join(" ");
  if (EMAIL.test(value) || SECRET_LITERAL.test(value) || /password|passcode|secret|token|private[-_ ]?key/i.test(target)) {
    throw new Error(`${label} must not contain literal secret or credential material`);
  }
  return undefined;
}

function parseStep(value: unknown, label: string): CrawlStep {
  const raw = object(value, label);
  const id = text(raw.id, `${label}.id`);
  const action = text(raw.action, `${label}.action`);
  if (!ACTIONS.has(action)) throw new Error(`${label}.action "${action}" is not one of ${[...ACTIONS].join(", ")}`);
  const safety = text(raw.safety, `${label}.safety`);
  if (safety !== "read" && safety !== "side-effect") throw new Error(`${label}.safety must be read or side-effect`);

  const step: CrawlStep = {
    id,
    action: action as CrawlAction,
    safety,
    expected: parseExpected(raw.expected, `${label}.expected`),
  };

  if (raw.optional !== undefined) step.optional = bool(raw.optional, `${label}.optional`);
  if (raw.optionalReason !== undefined) {
    if (step.optional !== true) throw new Error(`${label}.optionalReason is only allowed when ${label}.optional is true`);
    step.optionalReason = text(raw.optionalReason, `${label}.optionalReason`);
  }
  if (step.optional === true && !step.optionalReason) throw new Error(`${label}.optionalReason is required when optional is true`);
  if (raw.locatorReason !== undefined) step.locatorReason = text(raw.locatorReason, `${label}.locatorReason`);

  const locators = locatorCount(raw);
  if (action === "goto") {
    step.url = text(raw.url, `${label}.url`);
    if (locators > 0) throw new Error(`${label} (goto) must not have a locator`);
  } else if (action === "press") {
    step.key = text(raw.key, `${label}.key`);
    if (locators > 0) throw new Error(`${label} (press) must not have a locator`);
  } else {
    Object.assign(step, parseLocatorFields(raw, `${label} (${action})`));
    if (action === "fill") {
      step.value = text(raw.value, `${label}.value`);
      secretReference(step.value, `${label}.value`, raw);
    }
  }

  if ((step.css || step.expected.visible?.css || step.expected.hidden?.css) && !step.locatorReason) {
    throw new Error(`${label}.locatorReason is required for CSS locators`);
  }
  return step;
}

// One step on its own — used by the repair loop to validate an LLM-suggested replacement.
export function parseCrawlStep(value: unknown): CrawlStep {
  return parseStep(value, "step");
}

export function parseCrawlSteps(values: unknown): CrawlStep[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 5) {
    throw new Error("Agent episode must contain one to five steps");
  }
  const steps = values.map((value, index) => parseStep(value, `episode.steps[${index}]`));
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) throw new Error(`Duplicate step id ${step.id}`);
    seen.add(step.id);
  }
  return steps;
}

export function parseCrawlPlan(raw: string): CrawlPlan {
  let root: JsonObject;
  try {
    root = object(JSON.parse(raw), "plan");
  } catch (error) {
    throw new Error(`Crawl plan is not valid JSON: ${(error as Error).message}`);
  }

  const revision = positiveInteger(root.revision, "plan.revision");
  const startUrl = text(root.startUrl, "plan.startUrl");
  new URL(startUrl); // must be absolute
  const sources = Array.isArray(root.sources) ? root.sources.map((source, i) => text(source, `plan.sources[${i}]`)) : [];

  if (!Array.isArray(root.flows) || root.flows.length === 0) throw new Error("plan.flows must be a non-empty array");
  const seenFlows = new Set<string>();
  const flows = root.flows.map((flowValue, i): CrawlFlow => {
    const label = `plan.flows[${i}]`;
    const flow = object(flowValue, label);
    const id = text(flow.id, `${label}.id`);
    if (seenFlows.has(id)) throw new Error(`Duplicate flow id ${id}`);
    seenFlows.add(id);
    if (!Array.isArray(flow.requiredSecrets)) throw new Error(`${label}.requiredSecrets must be an array`);
    const requiredSecrets = flow.requiredSecrets.map((value, j) => {
      if (typeof value !== "string" || !SECRET_NAME.test(value)) {
        throw new Error(`${label}.requiredSecrets[${j}] must be a valid secret name matching [A-Z][A-Z0-9_]*`);
      }
      return value;
    });
    const seenSecrets = new Set<string>();
    for (const name of requiredSecrets) {
      if (seenSecrets.has(name)) throw new Error(`Duplicate required secret ${name}`);
      seenSecrets.add(name);
    }
    if (!Array.isArray(flow.steps)) throw new Error(`${label}.steps must be an array`);
    const seenSteps = new Set<string>();
    const steps = flow.steps.map((stepValue, j) => {
      const step = parseStep(stepValue, `${label}.steps[${j}]`);
      if (seenSteps.has(step.id)) throw new Error(`Duplicate step id ${step.id}`);
      seenSteps.add(step.id);
      return step;
    });
    const safe = bool(flow.safe, `${label}.safe`);
    if (safe && steps.some((step) => step.safety === "side-effect")) throw new Error(`${label} contains a side-effect step in a safe flow`);

    const referencedSecrets = new Set(
      steps.flatMap((step) => {
        if (step.action !== "fill" || !step.value) return [];
        const match = SECRET_REFERENCE.exec(step.value);
        return match ? [match[1]] : [];
      })
    );
    for (const name of referencedSecrets) {
      if (!seenSecrets.has(name)) throw new Error(`${label}.requiredSecrets must include ${name} referenced by fill steps`);
    }
    for (const name of seenSecrets) {
      if (!referencedSecrets.has(name)) throw new Error(`${label}.requiredSecrets declares ${name} but no fill step references it`);
    }

    return {
      id,
      title: text(flow.title, `${label}.title`),
      description: typeof flow.description === "string" ? flow.description.trim() : "",
      safe,
      requiredSecrets,
      steps,
    };
  });

  return {
    app: text(root.app, "plan.app"),
    revision,
    startUrl,
    domain: typeof root.domain === "string" ? root.domain.trim() : "",
    sources,
    reviewed: bool(root.reviewed, "plan.reviewed"),
    flows,
  };
}

function matchesWildcard(actual: string, source: string): boolean {
  const collapsed: string[] = [];
  for (const character of source) {
    if (character !== "*" || collapsed.at(-1) !== "*") collapsed.push(character);
  }
  const pattern = collapsed.join("");
  let actualIndex = 0;
  let patternIndex = 0;
  let starIndex = -1;
  let retryIndex = 0;
  while (actualIndex < actual.length) {
    if (patternIndex < pattern.length && pattern[patternIndex] === actual[actualIndex]) {
      actualIndex++;
      patternIndex++;
    } else if (pattern[patternIndex] === "*") {
      starIndex = patternIndex++;
      retryIndex = actualIndex;
    } else if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      actualIndex = ++retryIndex;
    } else {
      return false;
    }
  }
  while (pattern[patternIndex] === "*") patternIndex++;
  return patternIndex === pattern.length;
}

export function urlMatchesExpectation(actual: string, expected: Pick<ExpectedState, "url" | "urlPattern">): boolean {
  if (expected.url !== undefined) return actual === expected.url;
  return expected.urlPattern === undefined || matchesWildcard(actual, expected.urlPattern);
}

// "$TEST_EMAIL" -> env.TEST_EMAIL; ordinary non-secret literals pass through verbatim.
// A missing variable is a hard error — silently typing "$TEST_EMAIL" into a form helps nobody.
export function resolveValue(value: string, env: Record<string, string | undefined> = process.env): string {
  const name = secretReference(value, "Step value", {});
  if (!name) return value;
  const resolved = env[name];
  if (resolved === undefined) throw new Error(`Step value references $${name} but it is not set in the environment`);
  return resolved;
}

export function resolveStepUrl(startUrl: string, url: string): string {
  return new URL(url, startUrl).toString();
}
