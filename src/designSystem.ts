import { publicImageUrl } from "./imageSource.ts";

export type TokenKind = "color" | "typography" | "spacing" | "radius" | "border" | "effect";

export interface EvidenceView {
  imageId: number;
  imageUrl: string;
  description: string | null;
}

export interface DesignToken<T = number> {
  id: string;
  kind: TokenKind;
  name: string;
  value: string;
  role: string;
  evidence: T[];
}

export interface ComponentVariant<T = number> {
  id: string;
  name: string;
  description: string;
  evidence: T[];
}

export interface DesignComponent<T = number> {
  id: string;
  name: string;
  category: string;
  description: string;
  variants: ComponentVariant<T>[];
}

export interface DesignFlow<T = number> {
  id: string;
  title: string;
  description: string;
  tags: string[];
  steps: Array<{ label: string; evidence: T[] }>;
}

export interface DesignSystemSnapshot<T = number> {
  app: string;
  generatedAt: string;
  tokens: DesignToken<T>[];
  components: DesignComponent<T>[];
  flows: DesignFlow<T>[];
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
      }];
    });
    if (variants.length === 0) return [];
    return [{
      id: text(item.id, "component.id"),
      name: text(item.name, "component.name"),
      category: text(item.category, "component.category"),
      description: text(item.description, "component.description"),
      variants,
    }];
  });

  return { app, generatedAt, tokens, components, flows: [] };
}

export function hydrateDesignSystem(
  snapshot: DesignSystemSnapshot,
  images: Array<{ id: number; image_url: string; description: string | null }>,
): DesignSystemSnapshot<EvidenceView> {
  const byId = new Map(images.map((image) => [image.id, image]));
  const hydrate = (ids: number[]): EvidenceView[] => ids.flatMap((imageId) => {
    const image = byId.get(imageId);
    return image ? [{
      imageId,
      imageUrl: publicImageUrl(snapshot.app, image.image_url),
      description: image.description,
    }] : [];
  });

  return {
    ...snapshot,
    tokens: snapshot.tokens.map((token) => ({ ...token, evidence: hydrate(token.evidence) })),
    components: snapshot.components.map((component) => ({
      ...component,
      variants: component.variants.map((variant) => ({ ...variant, evidence: hydrate(variant.evidence) })),
    })),
    flows: snapshot.flows.map((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => ({ ...step, evidence: hydrate(step.evidence) })),
    })),
  };
}
