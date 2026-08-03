import type {
  DesignComponent,
  DesignSystemSnapshot,
  DesignToken,
  TokenKind,
} from "./designSystem.ts";
import type { SiteAnalysis } from "./siteAnalysis.ts";

type RecordValue = Record<string, unknown>;

export interface SiteDesignSystemInput {
  app: string;
  sourceUrl: string;
  analysis: Pick<
    SiteAnalysis,
    "structure" | "visualTokens" | "motion" | "responsive"
  >;
  generatedAt?: string;
}

interface TokenCandidate {
  kind: TokenKind;
  value: string;
  role: string;
  evidence: Set<string>;
  count: number;
}

const TOKEN_LIMIT: Record<TokenKind, number> = {
  color: 24,
  typography: 18,
  spacing: 24,
  radius: 12,
  border: 12,
  effect: 12,
};

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
}

function string(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.replace(/\s+/g, " ").trim();
  return result || undefined;
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function stableId(prefix: string, value: string): string {
  const hash = (seed: number) => {
    let result = seed;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16_777_619);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  };
  return `${prefix}-${hash(2_166_136_261)}${hash(3_332_090_591)}`;
}

function title(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function structureRole(node: RecordValue | undefined): string {
  const tag = string(node?.tag)?.toLowerCase();
  const role = string(node?.role)?.toLowerCase();
  if (role === "button" || tag === "button") return "Action";
  if (role === "navigation" || tag === "nav") return "Navigation";
  if (role === "dialog" || role === "alertdialog" || tag === "dialog") return "Dialog";
  if (tag === "header") return "Header";
  if (tag === "footer") return "Footer";
  if (tag === "h1") return "Display";
  if (tag === "h2" || tag === "h3") return "Heading";
  if (["input", "select", "textarea", "label", "form"].includes(tag ?? "")) return "Form";
  if (["img", "picture", "video", "canvas", "svg"].includes(tag ?? "")) return "Media";
  if (tag === "section" || tag === "article") return "Section";
  if (tag === "main" || tag === "body") return "Canvas";
  return "Interface";
}

function addCandidate(
  candidates: Map<string, TokenCandidate>,
  kind: TokenKind,
  value: unknown,
  role: string,
  evidenceId: string,
): void {
  const normalized = string(value);
  if (!normalized || normalized === "none" || normalized === "normal" || normalized === "0px") return;
  const key = `${kind}\0${normalized}\0${role}`;
  const existing = candidates.get(key);
  if (existing) {
    existing.count += 1;
    existing.evidence.add(evidenceId);
    return;
  }
  candidates.set(key, {
    kind,
    value: normalized,
    role,
    evidence: new Set([evidenceId]),
    count: 1,
  });
}

function colorValues(value: unknown): string[] {
  const source = string(value);
  if (!source) return [];
  const matches = source.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? [];
  return [...new Set(matches.map((item) => item.toLowerCase()))];
}

function lengthValues(value: unknown): string[] {
  const source = string(value);
  if (!source) return [];
  return [...new Set(source.match(/-?(?:\d*\.)?\d+(?:px|rem|em|%|vw|vh)\b/gi) ?? [])]
    .filter((item) => item !== "0px" && item !== "0rem" && item !== "0em");
}

function typographyValue(style: RecordValue): string | undefined {
  const family = string(style.fontFamily);
  const size = string(style.fontSize);
  if (!family || !size) return undefined;
  const weight = string(style.fontWeight) ?? "400";
  const lineHeight = string(style.lineHeight) ?? "normal";
  const letterSpacing = string(style.letterSpacing);
  return [family, size, weight, lineHeight, letterSpacing].filter(Boolean).join(" / ");
}

function customPropertyKind(name: string, value: string): TokenKind | undefined {
  if (colorValues(value).length) return "color";
  const normalized = name.toLowerCase();
  if (/radius|rounded|corner/.test(normalized)) return "radius";
  if (/shadow|effect|blur|filter|opacity/.test(normalized)) return "effect";
  if (/border|stroke|outline/.test(normalized)) return "border";
  if (/font|type|line-height|letter-spacing|tracking/.test(normalized)) return "typography";
  if (/space|gap|padding|margin|gutter|size|width|height/.test(normalized) && lengthValues(value).length) {
    return "spacing";
  }
  return undefined;
}

function tokenName(candidate: TokenCandidate, ordinal: number): string {
  const suffix = ordinal > 0 ? ` ${ordinal + 1}` : "";
  return `${candidate.role} ${title(candidate.kind)}${suffix}`;
}

function extractTokens(
  analysis: SiteDesignSystemInput["analysis"],
  structureById: Map<string, RecordValue>,
): DesignToken<string>[] {
  const candidates = new Map<string, TokenCandidate>();
  for (const rawStyle of analysis.visualTokens) {
    const style = record(rawStyle);
    const evidenceId = string(style?.structureId);
    if (!style || !evidenceId || !structureById.has(evidenceId)) continue;
    const role = structureRole(structureById.get(evidenceId));
    const customProperties = record(style.customProperties);
    if (customProperties) {
      for (const [name, rawValue] of Object.entries(customProperties)) {
        const value = string(rawValue);
        const kind = value ? customPropertyKind(name, value) : undefined;
        if (kind && value) addCandidate(candidates, kind, value, `CSS variable ${name}`, evidenceId);
      }
    }
    for (const value of colorValues(style.color)) {
      addCandidate(candidates, "color", value, `${role} foreground`, evidenceId);
    }
    for (const value of colorValues(style.background)) {
      addCandidate(candidates, "color", value, `${role} surface`, evidenceId);
    }
    const typography = typographyValue(style);
    if (typography) addCandidate(candidates, "typography", typography, `${role} text`, evidenceId);
    for (const [property, value] of [["gap", style.gap], ["padding", style.padding], ["margin", style.margin]] as const) {
      for (const length of lengthValues(value)) {
        addCandidate(candidates, "spacing", length, `${role} ${property}`, evidenceId);
      }
    }
    for (const value of lengthValues(style.borderRadius)) {
      addCandidate(candidates, "radius", value, `${role} corner`, evidenceId);
    }
    if (string(style.border) && string(style.border) !== "0px none rgb(0, 0, 0)") {
      addCandidate(candidates, "border", style.border, `${role} boundary`, evidenceId);
    }
    for (const [property, value] of [["box shadow", style.boxShadow], ["filter", style.filter], ["transform", style.transform]] as const) {
      if (string(value) && string(value) !== "none") {
        addCandidate(candidates, "effect", value, `${role} ${property}`, evidenceId);
      }
    }
  }

  const byKind = new Map<TokenKind, TokenCandidate[]>();
  for (const candidate of candidates.values()) {
    byKind.set(candidate.kind, [...(byKind.get(candidate.kind) ?? []), candidate]);
  }
  const tokens: DesignToken<string>[] = [];
  for (const kind of ["color", "typography", "spacing", "radius", "border", "effect"] as const) {
    const selected = (byKind.get(kind) ?? [])
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      .slice(0, TOKEN_LIMIT[kind]);
    const roleCounts = new Map<string, number>();
    for (const candidate of selected) {
      const ordinal = roleCounts.get(candidate.role) ?? 0;
      roleCounts.set(candidate.role, ordinal + 1);
      tokens.push({
        id: stableId(`site-${kind}`, `${candidate.value}\0${candidate.role}`),
        kind,
        name: tokenName(candidate, ordinal),
        value: candidate.value,
        role: `Observed ${candidate.role.toLowerCase()} value`,
        evidence: [...candidate.evidence].slice(0, 20),
        confidence: Math.min(0.98, 0.72 + candidate.count * 0.03),
        reviewStatus: "needs_review",
      });
    }
  }
  return tokens;
}

function componentName(node: RecordValue): string | undefined {
  const tag = string(node.tag)?.toLowerCase();
  const role = string(node.role)?.toLowerCase();
  if (role === "button" || tag === "button") return "Button";
  if (role === "navigation" || tag === "nav") return "Navigation";
  if (role === "dialog" || role === "alertdialog" || tag === "dialog") return "Dialog";
  if (role === "tab" || role === "tablist") return "Tabs";
  if (tag === "header") return "Header";
  if (tag === "footer") return "Footer";
  if (tag === "form") return "Form";
  if (tag === "input") return "Input";
  if (tag === "select") return "Select";
  if (tag === "textarea") return "Textarea";
  if (tag === "a") return "Link";
  if (["h1", "h2", "h3"].includes(tag ?? "")) return "Heading";
  if (tag === "section" || tag === "article") return "Content section";
  if (["img", "picture", "video", "canvas", "svg"].includes(tag ?? "")) return "Media";
  return undefined;
}

function variantName(node: RecordValue, fallback: string): string {
  const label = string(node.accessibleName) ?? string(node.heading) ?? string(node.text);
  if (!label) return fallback;
  return label.split(/\s+/).slice(0, 8).join(" ").slice(0, 80);
}

function extractComponents(
  analysis: SiteDesignSystemInput["analysis"],
  tokens: DesignToken<string>[],
): DesignComponent<string>[] {
  const styles = new Map<string, RecordValue>();
  for (const raw of analysis.visualTokens) {
    const item = record(raw);
    const structureId = string(item?.structureId);
    if (item && structureId) styles.set(structureId, item);
  }
  const grouped = new Map<string, RecordValue[]>();
  for (const raw of analysis.structure) {
    const node = record(raw);
    if (!node || node.visible === false) continue;
    const name = componentName(node);
    if (!name) continue;
    grouped.set(name, [...(grouped.get(name) ?? []), node]);
  }
  return [...grouped.entries()].slice(0, 24).map(([name, nodes]) => {
    const evidence = new Set(nodes.map((node) => string(node.id)).filter((id): id is string => Boolean(id)));
    const associatedTokenIds = tokens
      .filter((token) => token.evidence.some((id) => evidence.has(id)))
      .map((token) => token.id);
    return {
      id: stableId("site-component", name),
      name,
      category: name === "Content section" ? "Layout" : "Interface",
      description: `Observed ${name.toLowerCase()} patterns from the rendered page.`,
      variants: nodes.slice(0, 8).map((node, index) => {
        const evidenceId = string(node.id)!;
        const style = styles.get(evidenceId);
        const observedProperties = style
          ? ["display", "padding", "gap", "border", "borderRadius", "background", "color", "fontSize"]
            .flatMap((property) => string(style[property]) ? [`${property}: ${string(style[property])}`] : [])
          : [];
        return {
          id: stableId("site-variant", `${name}\0${evidenceId}`),
          name: variantName(node, index === 0 ? "Default" : `Variant ${index + 1}`),
          description: `Rendered ${name.toLowerCase()} instance.`,
          evidence: [evidenceId],
          observedProperties,
          confidence: 0.9,
          reviewStatus: "needs_review" as const,
        };
      }),
      anatomy: name === "Content section" ? ["Container", "Heading", "Content"] : undefined,
      associatedTokenIds: associatedTokenIds.slice(0, 24),
    };
  });
}

function extractRules(
  analysis: SiteDesignSystemInput["analysis"],
): NonNullable<DesignSystemSnapshot<string>["rules"]> {
  const rules: NonNullable<DesignSystemSnapshot<string>["rules"]> = [];
  const add = (
    kind: NonNullable<DesignSystemSnapshot<string>["rules"]>[number]["kind"],
    name: string,
    description: string,
    evidence: string[],
    confidence = 0.78,
  ) => {
    if (!description || evidence.length === 0) return;
    rules.push({
      id: stableId(`site-rule-${kind}`, description),
      kind,
      name,
      description,
      evidence: [...new Set(evidence)].slice(0, 20),
      confidence,
      reviewStatus: "needs_review",
    });
  };

  const structureById = new Map<string, RecordValue>();
  for (const raw of analysis.structure) {
    const node = record(raw);
    const id = string(node?.id);
    if (node && id) structureById.set(id, node);
  }
  for (const raw of analysis.visualTokens) {
    const style = record(raw);
    const evidenceId = string(style?.structureId);
    if (!style || !evidenceId || !structureById.has(evidenceId)) continue;
    const display = string(style.display);
    if (display !== "grid" && display !== "flex" && display !== "inline-flex") continue;
    const node = structureById.get(evidenceId);
    const role = structureRole(node).toLowerCase();
    const direction = display === "grid"
      ? string(style.gridTemplateColumns)
      : string(style.flexDirection);
    const gap = string(style.gap);
    add(
      "layout",
      `${title(role)} ${display} layout`,
      `Render the observed ${role} as ${display}${direction && direction !== "none" ? ` (${direction})` : ""}${gap && gap !== "normal" ? ` with ${gap} gap` : ""}.`,
      [evidenceId],
      0.96,
    );
  }

  const headings = analysis.structure.flatMap((raw) => {
    const node = record(raw);
    const id = string(node?.id);
    const tag = string(node?.tag)?.toLowerCase();
    return id && ["h1", "h2", "h3"].includes(tag ?? "") ? [{ id, tag: tag! }] : [];
  });
  if (headings.length) {
    const counts = ["h1", "h2", "h3"].flatMap((tag) => {
      const count = headings.filter((heading) => heading.tag === tag).length;
      return count ? [`${count} ${tag.toUpperCase()}`] : [];
    });
    add(
      "content",
      "Heading hierarchy",
      `Preserve the rendered heading hierarchy (${counts.join(", ")}).`,
      headings.map(({ id }) => id),
      0.98,
    );
  }

  const media = analysis.structure.flatMap((raw) => {
    const node = record(raw);
    const id = string(node?.id);
    const tag = string(node?.tag)?.toLowerCase();
    return id && ["img", "picture", "video", "canvas"].includes(tag ?? "") ? [{ id, tag: tag! }] : [];
  });
  if (media.length) {
    add(
      "imagery",
      "Rendered media",
      `Use the observed media mix: ${[...new Set(media.map(({ tag }) => tag))].join(", ")}.`,
      media.map(({ id }) => id),
      0.98,
    );
  }
  for (const finding of analysis.responsive) {
    const item = record(finding);
    const id = string(item?.id);
    const change = string(item?.change);
    const key = string(item?.key);
    if (id && change) add("responsive", title(change), `${key ? `${key} is ` : ""}${change}.`, [id], 0.94);
  }
  for (const finding of analysis.motion) {
    add(
      "interaction",
      `${title(finding.type)} motion`,
      `Use ${finding.type} motion triggered by ${finding.trigger} for the observed element.`,
      finding.evidenceIds,
      finding.confidence,
    );
  }
  return rules.slice(0, 50);
}

function detectedTheme(tokens: DesignToken<string>[]): "light" | "dark" | undefined {
  const surface = tokens.find((token) => token.kind === "color" && /canvas surface/i.test(token.name))
    ?? tokens.find((token) => token.kind === "color" && /surface/i.test(token.name));
  const match = surface?.value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  if (!match) return undefined;
  const luminance = (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255;
  return luminance < 0.45 ? "dark" : "light";
}

export function createSiteDesignSystem(input: SiteDesignSystemInput): DesignSystemSnapshot<string> {
  const app = string(input.app);
  const sourceUrl = string(input.sourceUrl);
  if (!app || !sourceUrl) throw new Error("Site design-system identity is missing");
  const structureById = new Map<string, RecordValue>();
  for (const raw of input.analysis.structure) {
    const node = record(raw);
    const id = string(node?.id);
    if (node && id) structureById.set(id, node);
  }
  const tokens = extractTokens(input.analysis, structureById);
  const components = extractComponents(input.analysis, tokens);
  return {
    app,
    generatedAt: new Date(input.generatedAt ?? Date.now()).toISOString(),
    summary: `Extracted from ${app}'s rendered HTML and computed CSS: ${tokens.length} design tokens and ${components.length} component families.`,
    provenance: {
      provider: "vitrines",
      sourceUrl,
      originalUrl: sourceUrl,
      attribution: "Extracted from HTML, CSS, and computed browser styles",
      ...(detectedTheme(tokens) ? { theme: detectedTheme(tokens) } : {}),
    },
    tokens,
    components,
    flows: [],
    rules: extractRules(input.analysis),
  };
}

export function parseSiteDesignSystem(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
): DesignSystemSnapshot<string> {
  const input = record(value);
  if (!input) throw new Error("Invalid Site design system");
  const app = string(input.app);
  const generatedAt = string(input.generatedAt);
  if (!app || !generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error("Invalid Site design-system identity");
  }
  const checkEvidence = (raw: unknown): string[] => {
    if (!Array.isArray(raw) || raw.length > 50) throw new Error("Invalid Site design-system evidence");
    const ids = raw.map(string);
    if (ids.some((id) => !id || !allowedEvidenceIds.has(id))) {
      throw new Error("Site design system references unknown evidence");
    }
    return [...new Set(ids as string[])];
  };
  const tokens = Array.isArray(input.tokens) ? input.tokens : [];
  const components = Array.isArray(input.components) ? input.components : [];
  const rules = Array.isArray(input.rules) ? input.rules : [];
  if (tokens.length > 200 || components.length > 100 || rules.length > 100) {
    throw new Error("Site design system is too large");
  }
  for (const raw of tokens) checkEvidence(record(raw)?.evidence);
  for (const raw of components) {
    const variants = record(raw)?.variants;
    if (!Array.isArray(variants) || variants.length > 50) throw new Error("Invalid Site component variants");
    for (const variant of variants) checkEvidence(record(variant)?.evidence);
  }
  for (const raw of rules) checkEvidence(record(raw)?.evidence);
  return structuredClone(value) as DesignSystemSnapshot<string>;
}
