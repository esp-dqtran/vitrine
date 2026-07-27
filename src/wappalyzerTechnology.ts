import type { SiteTechnologyFinding } from "./siteAnalysis.ts";

type TechnologyCategory = SiteTechnologyFinding["category"];

interface WappalyzerCategory {
  name?: unknown;
}

export interface WappalyzerDetection {
  name?: unknown;
  slug?: unknown;
  categories?: unknown;
  confidence?: unknown;
  version?: unknown;
  icon?: unknown;
}

export function normalizeWappalyzerTechnology(
  value: unknown,
): SiteTechnologyFinding[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error("Invalid Wappalyzer detections");
  }
  const findings = value.map((item) => normalizeDetection(item));
  const ids = new Set<string>();
  for (const finding of findings) {
    if (ids.has(finding.id)) throw new Error("Duplicate Wappalyzer technology");
    ids.add(finding.id);
  }
  return findings;
}

export function mergeWappalyzerTechnology(
  native: SiteTechnologyFinding[],
  detected: SiteTechnologyFinding[],
): SiteTechnologyFinding[] {
  const nativeByKey = new Map(native.map((finding) => [
    technologyKey(finding),
    finding,
  ]));
  const merged = detected.map((finding) => {
    const existing = nativeByKey.get(technologyKey(finding));
    nativeByKey.delete(technologyKey(finding));
    return existing
      ? {
          ...finding,
          evidenceIds: [...new Set([
            ...finding.evidenceIds,
            ...existing.evidenceIds,
          ])],
        }
      : finding;
  });
  return [
    ...merged,
    ...[...nativeByKey.values()].map((finding) => ({
      ...finding,
      source: finding.source ?? "native" as const,
    })),
  ];
}

function normalizeDetection(value: unknown): SiteTechnologyFinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Wappalyzer detection");
  }
  const input = value as WappalyzerDetection;
  const name = requiredText(input.name, 200, "name");
  const slug = requiredSlug(input.slug);
  const categories = categoryNames(input.categories);
  const confidence = requiredConfidence(input.confidence);
  const icon = optionalIcon(input.icon);
  const version = optionalText(input.version, 200, "version");
  return {
    id: `TECHNOLOGY-WAPPALYZER-${slug.toUpperCase()}`,
    name,
    slug,
    categories,
    ...(icon ? { icon } : {}),
    source: "wappalyzer",
    ...(version ? { version } : {}),
    category: primaryCategory(categories),
    state: confidence >= 1 ? "confirmed" : "observed-in-use",
    evidenceIds: [],
    confidence,
  };
}

function categoryNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error("Invalid Wappalyzer categories");
  }
  return [...new Set(value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid Wappalyzer category");
    }
    return requiredText(
      (item as WappalyzerCategory).name,
      200,
      "category",
    );
  }))];
}

function primaryCategory(categories: string[]): TechnologyCategory {
  const value = categories.join(" ").toLowerCase();
  if (/\bframework|renderer|javascript librar|ui framework\b/.test(value)) {
    return "framework";
  }
  if (/\bbuild|bundler|module packager\b/.test(value)) return "bundler";
  if (/\banimation|video|audio|media|font\b/.test(value)) {
    return /\banimation\b/.test(value) ? "animation" : "media";
  }
  return "service";
}

function requiredConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Invalid Wappalyzer confidence");
  }
  return value / 100;
}

function requiredSlug(value: unknown): string {
  const slug = requiredText(value, 200, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Invalid Wappalyzer slug");
  }
  return slug;
}

function optionalIcon(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const icon = requiredText(value, 200, "icon");
  if (
    !/^[A-Za-z0-9][A-Za-z0-9 ._()+@'-]*\.(?:svg|png|webp)$/i.test(icon) ||
    icon.includes("..")
  ) {
    throw new Error("Invalid Wappalyzer icon");
  }
  return icon;
}

function optionalText(
  value: unknown,
  maximum: number,
  label: string,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, maximum, label);
}

function requiredText(
  value: unknown,
  maximum: number,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    value.length > maximum
  ) {
    throw new Error(`Invalid Wappalyzer ${label}`);
  }
  const result = value.replace(/\s+/g, " ").trim();
  if (!result) throw new Error(`Invalid Wappalyzer ${label}`);
  return result;
}

function technologyKey(finding: SiteTechnologyFinding): string {
  return finding.slug ?? finding.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
