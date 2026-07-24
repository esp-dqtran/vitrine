import { publicImageUrl } from "./imageSource.ts";
import type { FlowProvenance } from "./autonomousGraph.ts";

export type TokenKind = "color" | "typography" | "spacing" | "radius" | "border" | "effect";

export interface EvidenceView {
  imageId: number;
  imageUrl: string;
  description: string | null;
  capturedAt?: string | null;
  responsiveViewport?: string;
  sourceUrl?: string | null;
}

export type ReviewStatus = "needs_review" | "reviewed" | "rejected";
export type DesignInferenceSource = "llm_inferred";
export interface EvidenceOccurrence<T = number> {
  imageId: number;
  region?: { x: number; y: number; width: number; height: number };
  coordinateSpace?: "normalized";
  cropImageId?: number;
  crop?: T;
  confidence?: number;
}

export interface DesignToken<T = number> {
  id: string;
  kind: TokenKind;
  name: string;
  value: string;
  role: string;
  evidence: T[];
  confidence?: number;
  reviewStatus?: ReviewStatus;
  responsiveViewports?: string[];
  occurrences?: EvidenceOccurrence<T>[];
  source?: DesignInferenceSource;
}

export interface ComponentVariant<T = number> {
  id: string;
  name: string;
  description: string;
  evidence: T[];
  observedProperties?: string[];
  observedStates?: string[];
  confidence?: number;
  reviewStatus?: ReviewStatus;
  responsiveViewports?: string[];
  occurrences?: EvidenceOccurrence<T>[];
  source?: DesignInferenceSource;
  reconstruction?: {
    layoutMode?: "HORIZONTAL" | "VERTICAL";
    width?: number;
    height?: number;
    padding?: number;
    gap?: number;
    fill?: string;
    stroke?: string;
    radius?: number;
    visibleText?: string;
  };
}

export interface DesignComponent<T = number> {
  id: string;
  name: string;
  category: string;
  description: string;
  variants: ComponentVariant<T>[];
  anatomy?: string[];
  associatedTokenIds?: string[];
  responsiveBehavior?: string[];
}

export interface DesignFlowInsights<T = number> {
  purpose: string;
  feedback: string[];
  openQuestions: string[];
  confidence: number;
  reviewStatus: "needs_review";
  source: "llm_inferred";
  evidence: T[];
}

export interface DesignFlow<T = number> {
  id: string;
  title: string;
  /** Parent grouping observed on Mobbin (e.g. "Run detail" for "Copying a code from Run detail"); absent for top-level flows. */
  category?: string;
  description: string;
  tags: string[];
  steps: Array<{ label: string; interaction?: string; evidence: T[] }>;
  provenance?: FlowProvenance;
  insights?: DesignFlowInsights<T>;
}

export interface DesignSystemSnapshot<T = number> {
  app: string;
  generatedAt: string;
  summary?: string;
  tokens: DesignToken<T>[];
  components: DesignComponent<T>[];
  flows: DesignFlow<T>[];
  rules?: Array<{
    id: string;
    kind: "layout" | "icon" | "imagery" | "responsive" | "content" | "interaction";
    name: string;
    description: string;
    evidence: T[];
    confidence?: number;
    reviewStatus?: ReviewStatus;
    source?: DesignInferenceSource;
  }>;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function evidence(value: unknown, allowedImageIds: ReadonlySet<number>): number[] {
  return [
    ...new Set(
      list(value).filter(
        (id): id is number => typeof id === "number" && Number.isInteger(id) && allowedImageIds.has(id),
      ),
    ),
  ];
}

function confidence(value: unknown): number {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : 0.5;
}

function reconstruction(value: unknown): ComponentVariant["reconstruction"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as JsonObject;
  const number = (field: string) => typeof item[field] === "number" && Number(item[field]) >= 0 ? Number(item[field]) : undefined;
  const layoutMode = item.layoutMode === "HORIZONTAL" || item.layoutMode === "VERTICAL" ? item.layoutMode : undefined;
  return { layoutMode, width: number("width"), height: number("height"), padding: number("padding"), gap: number("gap"), radius: number("radius"), fill: typeof item.fill === "string" ? item.fill : undefined, stroke: typeof item.stroke === "string" ? item.stroke : undefined, visibleText: typeof item.visibleText === "string" ? item.visibleText : undefined };
}

function stripFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function parseDesignSystemSnapshot(
  raw: string,
  app: string,
  allowedImageIds: ReadonlySet<number>,
  generatedAt = new Date().toISOString(),
): DesignSystemSnapshot {
  let parsed: JsonObject;
  try {
    parsed = object(JSON.parse(stripFence(raw)), "snapshot");
  } catch (error) {
    throw new Error(`Synthesis did not return valid JSON: ${(error as Error).message}`);
  }

  const tokens = list(parsed.tokens).flatMap((value): DesignToken[] => {
    const item = object(value, "token");
    const refs = evidence(item.evidence, allowedImageIds);
    if (refs.length === 0) return [];
    const kind = text(item.kind, "token.kind") as TokenKind;
    if (!["color", "typography", "spacing", "radius", "border", "effect"].includes(kind)) {
      throw new Error(`Unsupported token kind: ${kind}`);
    }
    return [{
      id: text(item.id, "token.id"),
      kind,
      name: text(item.name, "token.name"),
      value: text(item.value, "token.value"),
      role: text(item.role, "token.role"),
      evidence: refs,
      confidence: confidence(item.confidence),
      reviewStatus: "needs_review",
      responsiveViewports: list(item.responsiveViewports).filter((value): value is string => typeof value === "string"),
      occurrences: refs.map((imageId) => ({ imageId, confidence: confidence(item.confidence) })),
      ...(item.source === "llm_inferred" ? { source: "llm_inferred" as const } : {}),
    }];
  });

  const components = list(parsed.components).flatMap((value): DesignComponent[] => {
    const item = object(value, "component");
    const variants = list(item.variants).flatMap((variantValue): ComponentVariant[] => {
      const variant = object(variantValue, "component.variant");
      const refs = evidence(variant.evidence, allowedImageIds);
      return refs.length === 0 ? [] : [{
        id: text(variant.id, "component.variant.id"),
        name: text(variant.name, "component.variant.name"),
        description: text(variant.description, "component.variant.description"),
        evidence: refs,
        observedProperties: list(variant.observedProperties).filter((value): value is string => typeof value === "string"),
        observedStates: list(variant.observedStates).filter((value): value is string => typeof value === "string"),
        confidence: confidence(variant.confidence),
        reviewStatus: "needs_review",
        responsiveViewports: list(variant.responsiveViewports).filter((value): value is string => typeof value === "string"),
        occurrences: refs.map((imageId) => ({ imageId, confidence: confidence(variant.confidence) })),
        reconstruction: reconstruction(variant.reconstruction),
        ...(variant.source === "llm_inferred" ? { source: "llm_inferred" as const } : {}),
      }];
    });
    if (variants.length === 0) return [];
    return [{
      id: text(item.id, "component.id"),
      name: text(item.name, "component.name"),
      category: text(item.category, "component.category"),
      description: text(item.description, "component.description"),
      variants,
      anatomy: list(item.anatomy).filter((value): value is string => typeof value === "string"),
      associatedTokenIds: list(item.associatedTokenIds).filter((value): value is string => typeof value === "string"),
      responsiveBehavior: list(item.responsiveBehavior).filter((value): value is string => typeof value === "string"),
    }];
  });

  const rules = list(parsed.rules).flatMap((value) => {
    const item = object(value, "rule");
    const refs = evidence(item.evidence, allowedImageIds);
    const kind = text(item.kind, "rule.kind") as NonNullable<DesignSystemSnapshot["rules"]>[number]["kind"];
    if (!refs.length || !["layout", "icon", "imagery", "responsive", "content", "interaction"].includes(kind)) return [];
    return [{ id: text(item.id, "rule.id"), kind, name: text(item.name, "rule.name"), description: text(item.description, "rule.description"), evidence: refs, confidence: confidence(item.confidence), reviewStatus: "needs_review" as const, ...(item.source === "llm_inferred" ? { source: "llm_inferred" as const } : {}) }];
  });
  return { app, generatedAt, tokens, components, flows: [], rules };
}

export function hydrateDesignSystem(
  snapshot: DesignSystemSnapshot,
  images: Array<{ id: number; image_url: string; description: string | null; captured_at?: string | null; capture_url?: string | null; analysis?: { responsiveViewport?: string } | null }>,
  imageUrl: (app: string, source: string) => string = publicImageUrl,
): DesignSystemSnapshot<EvidenceView> {
  const byId = new Map(images.map((image) => [image.id, image]));
  const hydrateOne = (imageId: number): EvidenceView | undefined => {
    const image = byId.get(imageId);
    return image ? {
      imageId,
      imageUrl: imageUrl(snapshot.app, image.image_url),
      description: image.description,
      ...(image.captured_at !== undefined ? { capturedAt: image.captured_at } : {}),
      ...(image.analysis?.responsiveViewport ? { responsiveViewport: image.analysis.responsiveViewport } : {}),
      ...(image.capture_url !== undefined ? { sourceUrl: image.capture_url } : {}),
    } : undefined;
  };
  const hydrate = (ids: number[]): EvidenceView[] =>
    ids.flatMap((imageId) => {
      const result = hydrateOne(imageId);
      return result ? [result] : [];
    });
  const hydrateOccurrences = (occurrences: EvidenceOccurrence[] | undefined) =>
    occurrences?.map(({ crop: _ignored, ...occurrence }) => {
      const crop = occurrence.cropImageId === undefined
        ? undefined
        : hydrateOne(occurrence.cropImageId);
      return { ...occurrence, ...(crop ? { crop } : {}) };
    });

  return {
    ...snapshot,
    tokens: snapshot.tokens.map((token) => ({
      ...token,
      evidence: hydrate(token.evidence),
      occurrences: hydrateOccurrences(token.occurrences),
    })),
    components: snapshot.components.map((component) => ({
      ...component,
      variants: component.variants.map((variant) => ({
        ...variant,
        evidence: hydrate(variant.evidence),
        occurrences: hydrateOccurrences(variant.occurrences),
      })),
    })),
    flows: snapshot.flows.map(({ insights, ...flow }) => ({
      ...flow,
      steps: flow.steps.map((step) => ({ ...step, evidence: hydrate(step.evidence) })),
      ...(insights ? {
        insights: { ...insights, evidence: hydrate(insights.evidence) },
      } : {}),
    })),
    rules: snapshot.rules?.map((rule) => ({ ...rule, evidence: hydrate(rule.evidence) })),
  };
}
