import type { DesignSystemSnapshot } from "./designSystem.ts";
import { parseSiteDesignSystem } from "./siteDesignSystem.ts";

const MAX_TEXT = 2_048;
const MAX_EVIDENCE = 2_000;
const MAX_FINDINGS = 500;
const MAX_WARNINGS = 100;

export type SiteTechnologyState =
  | "confirmed"
  | "observed-in-use"
  | "loaded"
  | "inferred"
  | "not-detected";

export type SiteAnalysisStatus = "ready" | "evidence-only";

export interface SiteEvidence {
  id: string;
  kind:
    | "metadata"
    | "dom"
    | "computed-style"
    | "animation"
    | "mutation"
    | "script-url"
    | "source-map"
    | "runtime"
    | "frame";
  value: string;
}

export interface SiteTechnologyFinding {
  id: string;
  name: string;
  version?: string;
  slug?: string;
  categories?: string[];
  icon?: string;
  source?: "wappalyzer" | "native";
  category:
    | "framework"
    | "renderer"
    | "bundler"
    | "animation"
    | "media"
    | "service";
  state: SiteTechnologyState;
  evidenceIds: string[];
  confidence: number;
}

export interface SiteMotionFinding {
  id: string;
  targetEvidenceId: string;
  type:
    | "entrance"
    | "scroll-linked"
    | "sticky"
    | "continuous"
    | "ticker"
    | "carousel"
    | "parallax"
    | "three-dimensional"
    | "mask-reveal"
    | "unknown";
  trigger: "load" | "viewport-enter" | "scroll-progress" | "time" | "unknown";
  properties: string[];
  states: Array<Record<string, string | number>>;
  durationMs?: number;
  delayMs?: number;
  easing?: string;
  iterations?: number | "infinite";
  scrollRange?: { start: number; end: number };
  viewports: Array<"desktop" | "mobile">;
  evidenceIds: string[];
  confidence: number;
}

export interface SiteSynthesisClaim {
  kind: "observed" | "inferred" | "unknown";
  text: string;
  evidenceIds: string[];
  confidence: number;
}

export interface SiteAnalysisSynthesis {
  purpose: string;
  category: string;
  structure: string[];
  rendering: string[];
  motion: string[];
  technology: string[];
  responsive: string[];
  reconstructionPriorities: string[];
  unknowns: string[];
  claims: SiteSynthesisClaim[];
}

export interface SiteAnalysis {
  schemaVersion: 1 | 2;
  status: SiteAnalysisStatus;
  evidence: SiteEvidence[];
  structure: Array<Record<string, unknown> & { id: string }>;
  visualTokens: Array<Record<string, unknown> & { id: string }>;
  motion: SiteMotionFinding[];
  technology: SiteTechnologyFinding[];
  responsive: Array<Record<string, unknown> & { id: string }>;
  synthesis: SiteAnalysisSynthesis | null;
  designSystem?: DesignSystemSnapshot<string>;
  warnings: string[];
}

export function siteEvidenceId(
  kind: "structure" | "visual" | "motion" | "technology" | "responsive",
  position: number,
): string {
  const prefixes = {
    structure: "STRUCTURE",
    visual: "VISUAL",
    motion: "MOTION",
    technology: "TECHNOLOGY",
    responsive: "RESPONSIVE",
  } as const;
  if (!Number.isSafeInteger(position) || position < 0) {
    throw new Error("Invalid Site evidence position");
  }
  return `${prefixes[kind]}-${position}`;
}

export function parseSiteAnalysis(value: unknown): SiteAnalysis {
  const input = exactRecord(value, [
    "schemaVersion",
    "status",
    "evidence",
    "structure",
    "visualTokens",
    "motion",
    "technology",
    "responsive",
    "synthesis",
    "warnings",
  ], ["designSystem"]);
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) {
    throw new Error("Invalid Site analysis schema version");
  }
  const schemaVersion = input.schemaVersion;
  const status = enumValue(input.status, ["ready", "evidence-only"] as const);
  const evidence = boundedArray(input.evidence, MAX_EVIDENCE, "Site analysis evidence")
    .map(parseEvidence);
  uniqueIds(evidence, "Site analysis evidence");
  const evidenceIds = new Set(evidence.map(({ id }) => id));
  const structure = parseOpenFindings(input.structure, "Site analysis structure");
  const structureIds = new Set(structure.map(({ id }) => id));
  const visualTokens = parseOpenFindings(input.visualTokens, "Site analysis visual tokens");
  const responsive = parseOpenFindings(input.responsive, "Site analysis responsive findings");
  const motion = boundedArray(input.motion, MAX_FINDINGS, "Site analysis motion")
    .map((item) => parseMotion(item, evidenceIds, structureIds));
  uniqueIds(motion, "Site analysis motion");
  const technology = boundedArray(input.technology, MAX_FINDINGS, "Site analysis technology")
    .map((item) => parseTechnology(item, evidenceIds, schemaVersion));
  uniqueIds(technology, "Site analysis technology");
  const synthesis = input.synthesis === null
    ? null
    : parseSynthesis(input.synthesis, evidenceIds);
  const designSystem = input.designSystem === undefined || input.designSystem === null
    ? undefined
    : parseSiteDesignSystem(input.designSystem, evidenceIds);
  const warnings = boundedArray(input.warnings, MAX_WARNINGS, "Site analysis warnings")
    .map((item) => text(item, MAX_TEXT, false));
  return {
    schemaVersion,
    status,
    evidence,
    structure,
    visualTokens,
    motion,
    technology,
    responsive,
    synthesis,
    ...(designSystem ? { designSystem } : {}),
    warnings,
  };
}

function parseEvidence(value: unknown): SiteEvidence {
  const input = exactRecord(value, ["id", "kind", "value"]);
  return {
    id: identifier(input.id),
    kind: enumValue(input.kind, [
      "metadata",
      "dom",
      "computed-style",
      "animation",
      "mutation",
      "script-url",
      "source-map",
      "runtime",
      "frame",
    ] as const),
    value: text(input.value, MAX_TEXT, false),
  };
}

function parseTechnology(
  value: unknown,
  evidenceIds: Set<string>,
  schemaVersion: 1 | 2,
): SiteTechnologyFinding {
  const input = exactRecord(
    value,
    ["id", "name", "category", "state", "evidenceIds", "confidence"],
    schemaVersion === 2
      ? ["version", "slug", "categories", "icon", "source"]
      : ["version"],
  );
  const refs = references(input.evidenceIds, evidenceIds);
  const version = optionalText(input.version, 200);
  const slug = optionalTechnologySlug(input.slug);
  const categories = input.categories === undefined
    ? undefined
    : stringArray(input.categories, 20);
  const icon = optionalTechnologyIcon(input.icon);
  const source = input.source === undefined
    ? undefined
    : enumValue(input.source, ["wappalyzer", "native"] as const);
  return {
    id: identifier(input.id),
    name: text(input.name, 200),
    ...(version ? { version } : {}),
    ...(slug ? { slug } : {}),
    ...(categories ? { categories } : {}),
    ...(icon ? { icon } : {}),
    ...(source ? { source } : {}),
    category: enumValue(input.category, [
      "framework",
      "renderer",
      "bundler",
      "animation",
      "media",
      "service",
    ] as const),
    state: enumValue(input.state, [
      "confirmed",
      "observed-in-use",
      "loaded",
      "inferred",
      "not-detected",
    ] as const),
    evidenceIds: refs,
    confidence: confidence(input.confidence),
  };
}

function optionalTechnologySlug(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const slug = text(value, 200);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Invalid Site technology slug");
  }
  return slug;
}

function optionalTechnologyIcon(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.includes("\0") || value.length > 200) {
    throw new Error("Invalid Site technology icon");
  }
  const icon = text(value, 200);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+@'-]*\.(?:svg|png|webp)$/i.test(icon) ||
    icon.includes("..")
  ) {
    throw new Error("Invalid Site technology icon");
  }
  return icon;
}

function parseMotion(
  value: unknown,
  evidenceIds: Set<string>,
  structureIds: Set<string>,
): SiteMotionFinding {
  const input = exactRecord(
    value,
    [
      "id",
      "targetEvidenceId",
      "type",
      "trigger",
      "properties",
      "states",
      "viewports",
      "evidenceIds",
      "confidence",
    ],
    ["durationMs", "delayMs", "easing", "iterations", "scrollRange"],
  );
  const targetEvidenceId = identifier(input.targetEvidenceId);
  if (!structureIds.has(targetEvidenceId)) {
    throw new Error(`Site analysis target evidence is missing: ${targetEvidenceId}`);
  }
  const result: SiteMotionFinding = {
    id: identifier(input.id),
    targetEvidenceId,
    type: enumValue(input.type, [
      "entrance",
      "scroll-linked",
      "sticky",
      "continuous",
      "ticker",
      "carousel",
      "parallax",
      "three-dimensional",
      "mask-reveal",
      "unknown",
    ] as const),
    trigger: enumValue(input.trigger, [
      "load",
      "viewport-enter",
      "scroll-progress",
      "time",
      "unknown",
    ] as const),
    properties: stringArray(input.properties, 40),
    states: boundedArray(input.states, 40, "Site motion states")
      .map((item) => stringNumberRecord(item)),
    viewports: uniqueStringArray(input.viewports, ["desktop", "mobile"] as const),
    evidenceIds: references(input.evidenceIds, evidenceIds),
    confidence: confidence(input.confidence),
  };
  const durationMs = droppableNonNegative(input.durationMs);
  const delayMs = droppableNonNegative(input.delayMs);
  const easing = optionalText(input.easing, 200);
  if (durationMs !== undefined) result.durationMs = durationMs;
  if (delayMs !== undefined) result.delayMs = delayMs;
  if (easing) result.easing = easing;
  if (input.iterations !== undefined) {
    result.iterations = input.iterations === "infinite"
      ? "infinite"
      : nonNegative(input.iterations, "iterations");
  }
  if (input.scrollRange !== undefined) {
    const range = exactRecord(input.scrollRange, ["start", "end"]);
    const start = nonNegative(range.start, "scroll start");
    const end = nonNegative(range.end, "scroll end");
    if (end < start) throw new Error("Invalid Site motion scroll range");
    result.scrollRange = { start, end };
  }
  return result;
}

function parseSynthesis(
  value: unknown,
  evidenceIds: Set<string>,
): SiteAnalysisSynthesis {
  const input = exactRecord(value, [
    "purpose",
    "category",
    "structure",
    "rendering",
    "motion",
    "technology",
    "responsive",
    "reconstructionPriorities",
    "unknowns",
    "claims",
  ]);
  const claims = boundedArray(input.claims, 50, "Site synthesis claims").map((item) => {
    const claim = exactRecord(item, ["kind", "text", "evidenceIds", "confidence"]);
    const kind = enumValue(claim.kind, ["observed", "inferred", "unknown"] as const);
    const refs = references(claim.evidenceIds, evidenceIds);
    if (kind !== "unknown" && refs.length === 0) {
      throw new Error("Site synthesis claim requires evidence");
    }
    return {
      kind,
      text: text(claim.text, MAX_TEXT),
      evidenceIds: refs,
      confidence: confidence(claim.confidence),
    };
  });
  return {
    purpose: text(input.purpose, MAX_TEXT, false),
    category: text(input.category, 200, false),
    structure: stringArray(input.structure, 50),
    rendering: stringArray(input.rendering, 50),
    motion: stringArray(input.motion, 50),
    technology: stringArray(input.technology, 50),
    responsive: stringArray(input.responsive, 50),
    reconstructionPriorities: stringArray(input.reconstructionPriorities, 50),
    unknowns: stringArray(input.unknowns, 50),
    claims,
  };
}

function parseOpenFindings(
  value: unknown,
  label: string,
): Array<Record<string, unknown> & { id: string }> {
  const findings = boundedArray(value, MAX_FINDINGS, label).map((item) => {
    const input = openRecord(item);
    const id = identifier(input.id);
    return { ...boundedJsonObject(input), id };
  });
  uniqueIds(findings, label);
  return findings;
}

function boundedJsonObject(
  value: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 6 || Object.keys(value).length > 100) {
    throw new Error("Site analysis JSON is too large");
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const safeKey = text(key, 200);
    if (
      item === null ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    ) return [safeKey, item];
    if (typeof item === "string") return [safeKey, text(item, MAX_TEXT, false)];
    if (Array.isArray(item)) {
      if (item.length > 100) throw new Error("Site analysis JSON array is too large");
      return [safeKey, item.map((entry) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          return boundedJsonObject(entry as Record<string, unknown>, depth + 1);
        }
        if (
          entry === null ||
          typeof entry === "boolean" ||
          (typeof entry === "number" && Number.isFinite(entry))
        ) return entry;
        if (typeof entry === "string") return text(entry, MAX_TEXT, false);
        throw new Error("Invalid Site analysis JSON value");
      })];
    }
    if (item && typeof item === "object") {
      return [safeKey, boundedJsonObject(item as Record<string, unknown>, depth + 1)];
    }
    throw new Error("Invalid Site analysis JSON value");
  }));
}

function references(value: unknown, allowed: Set<string>): string[] {
  const ids = stringArray(value, 100).map(identifier);
  for (const id of ids) {
    if (!allowed.has(id)) throw new Error(`Site analysis evidence is missing: ${id}`);
  }
  return [...new Set(ids)];
}

function stringNumberRecord(value: unknown): Record<string, string | number> {
  const input = openRecord(value);
  if (Object.keys(input).length > 40) throw new Error("Site motion state is too large");
  return Object.fromEntries(Object.entries(input).map(([key, item]) => {
    if (typeof item === "string") return [text(key, 100), text(item, MAX_TEXT, false)];
    if (typeof item === "number" && Number.isFinite(item)) return [text(key, 100), item];
    throw new Error("Invalid Site motion state");
  }));
}

function stringArray(value: unknown, maximum: number): string[] {
  return boundedArray(value, maximum, "Site analysis string array")
    .map((item) => text(item, MAX_TEXT, false));
}

function uniqueStringArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number][] {
  return [...new Set(boundedArray(value, allowed.length, "Site analysis enum array")
    .map((item) => enumValue(item, allowed)))];
}

function uniqueIds(values: Array<{ id: string }>, label: string): void {
  if (new Set(values.map(({ id }) => id)).size !== values.length) {
    throw new Error(`${label} contains duplicate IDs`);
  }
}

function exactRecord(
  value: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  const input = openRecord(value);
  const keys = Object.keys(input);
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !(key in input)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new Error("Invalid Site analysis object");
  }
  return input;
}

function openRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Site analysis object");
  }
  return value as Record<string, unknown>;
}

function boundedArray(value: unknown, maximum: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function text(value: unknown, maximum: number, required = true): string {
  if (typeof value !== "string" || value.includes("\0") || value.length > maximum) {
    throw new Error("Invalid Site analysis text");
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new Error("Invalid Site analysis text");
  return normalized;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return text(value, maximum);
}

function identifier(value: unknown): string {
  const result = text(value, 200);
  if (!/^[A-Z][A-Z0-9-]*$/.test(result)) throw new Error("Invalid Site analysis ID");
  return result;
}

function confidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Invalid Site analysis confidence");
  }
  return value;
}

function nonNegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid Site motion ${label}`);
  }
  return value;
}

// Same, but a bad value drops the field instead of rejecting the analysis.
// These describe animation timing: a model returning a negative or null delay
// is not a reason to throw away a whole crawled Site, which is what a hard
// failure here does — the capture is already complete by this point.
function droppableNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error("Invalid Site analysis enum");
  }
  return value as T[number];
}
