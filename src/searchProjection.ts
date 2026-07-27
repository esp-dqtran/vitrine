import { createHash } from "node:crypto";
import type { CrawledImage } from "./db.ts";
import type { DesignFlow, DesignSystemSnapshot } from "./designSystem.ts";
import type { SearchDocument } from "./searchTypes.ts";

export interface PublishedSearchSource {
  version: {
    id: number;
    appId: number;
    app: string;
    platform: string;
    categories: string[];
    publishedAt: string;
  };
  images: CrawledImage[];
  system?: DesignSystemSnapshot;
  flows: DesignFlow[];
}

const ENTITY_ORDER = new Map([
  ["app", 0],
  ["screen", 1],
  ["component", 2],
  ["pattern", 3],
  ["flow", 4],
]);

export const searchDocumentText = (...parts: unknown[]) =>
  parts
    .flat(Infinity)
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => (value as string).trim())
    .join(" ");

export const uniqueSearchValues = (values: Array<string | undefined | null>): string[] =>
  [...new Set(values.filter((value): value is string => !!value?.trim()).map((value) => value.trim()))]
    .sort((a, b) => a.localeCompare(b));

const identityPart = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function searchDocumentRevision(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function flowMembership(flows: DesignFlow[]): Map<number, {
  flowId: string;
  flowName: string;
  flowStepIndex: number;
}> {
  const membership = new Map<number, {
    flowId: string;
    flowName: string;
    flowStepIndex: number;
  }>();
  for (const flow of flows) {
    flow.steps.forEach((step, flowStepIndex) => {
      for (const imageId of step.evidence) {
        if (!membership.has(imageId)) {
          membership.set(imageId, {
            flowId: flow.id,
            flowName: flow.title,
            flowStepIndex,
          });
        }
      }
    });
  }
  return membership;
}

function baseDocument(
  source: PublishedSearchSource,
  value: Omit<
    SearchDocument,
    "indexVersion" | "catalogScope" | "catalogName" | "versionId" | "appId"
    | "appName" | "catalogCategories" | "siteSections" | "siteStyles"
    | "platform" | "appCategory" | "publishedAt" | "sourceRevision"
  >,
): SearchDocument {
  const document = {
    ...value,
    indexVersion: 1 as const,
    catalogScope: "apps" as const,
    catalogName: source.version.app,
    versionId: source.version.id,
    appId: source.version.appId,
    appName: source.version.app,
    catalogCategories: source.version.categories,
    siteSections: [],
    siteStyles: [],
    platform: source.version.platform,
    publishedAt: source.version.publishedAt,
  };
  return { ...document, sourceRevision: searchDocumentRevision(document) };
}

function projectImage(
  source: PublishedSearchSource,
  image: CrawledImage,
  membership: ReturnType<typeof flowMembership>,
): SearchDocument {
  const analysis = image.analysis;
  const isScreen = image.kind === "screen";
  const flow = membership.get(image.id);
  const components = uniqueSearchValues(analysis?.componentNames ?? []);
  const states = uniqueSearchValues([
    ...(analysis?.visibleStates ?? []),
    ...(image.state_context ? image.state_context.split(",") : []),
  ]);
  const layouts = uniqueSearchValues(analysis?.layoutPatterns ?? []);
  const visibleText = uniqueSearchValues(analysis?.visibleText ?? []);
  const sourceId = isScreen ? `screen:${image.id}` : `ui-element:${image.id}`;
  const title = isScreen
    ? analysis?.purpose || image.description || `Screen ${image.id}`
    : components[0] || analysis?.purpose || image.description || `UI element ${image.id}`;
  const description = analysis?.description || image.description || "";
  const sourcePayload = {
    versionId: source.version.id,
    mediaImageId: image.id,
    imageUrl: image.image_url,
    captureUrl: image.capture_url ?? image.image_url,
    visibleTextCount: visibleText.length,
    ...(flow ? {
      flowId: flow.flowId,
      flowStepIndex: flow.flowStepIndex,
    } : {}),
  };
  return baseDocument(source, {
    documentId: sourceId,
    entityType: isScreen ? "screen" : "component",
    sourceId,
    title,
    description,
    aliases: isScreen ? [] : components,
    visibleText: searchDocumentText(visibleText),
    ...(analysis?.pageType ? { pageType: analysis.pageType } : {}),
    ...(analysis?.productArea ? { productArea: analysis.productArea } : {}),
    ...(flow ? flow : {}),
    components,
    states,
    ...(analysis?.theme ? { theme: analysis.theme } : {}),
    layoutPatterns: layouts,
    ...(image.captured_at ? { capturedAt: image.captured_at } : {}),
    mediaImageId: image.id,
    sourcePayload,
    searchText: searchDocumentText(
      title,
      description,
      source.version.app,
      source.version.categories,
      source.version.platform,
      visibleText,
      analysis?.pageType,
      analysis?.productArea,
      flow?.flowName,
      components,
      states,
      analysis?.theme,
      layouts,
    ),
  });
}

export function projectSearchDocuments(source: PublishedSearchSource): SearchDocument[] {
  const appKey = `${identityPart(source.version.app)}:${identityPart(source.version.platform)}`;
  const membership = flowMembership(source.flows);
  const documents: SearchDocument[] = [];
  const appSourceId = `app:${appKey}`;
  const appDescription = source.system?.summary ?? "";

  documents.push(baseDocument(source, {
    documentId: appSourceId,
    entityType: "app",
    sourceId: appSourceId,
    title: source.version.app,
    description: appDescription,
    aliases: [],
    visibleText: "",
    components: [],
    states: [],
    layoutPatterns: [],
    sourcePayload: { versionId: source.version.id },
    searchText: searchDocumentText(
      source.version.app,
      appDescription,
      source.version.categories,
      source.version.platform,
    ),
  }));

  for (const image of source.images) {
    if (image.kind === "screen" || image.kind === "ui_element") {
      documents.push(projectImage(source, image, membership));
    }
  }

  for (const component of source.system?.components ?? []) {
    const sourceId = `design-component:${appKey}:${identityPart(component.id)}`;
    const aliases = uniqueSearchValues([
      component.category,
      ...component.variants.flatMap((variant) => [variant.name]),
    ]);
    const visibleText = uniqueSearchValues(component.variants.flatMap((variant) =>
      variant.reconstruction?.visibleText ? [variant.reconstruction.visibleText] : []));
    const sourcePayload = {
      versionId: source.version.id,
      componentId: component.id,
      evidence: uniqueSearchValues(component.variants.flatMap((variant) =>
        variant.evidence.map(String))).map(Number),
    };
    documents.push(baseDocument(source, {
      documentId: sourceId,
      entityType: "component",
      sourceId,
      title: component.name,
      description: component.description,
      aliases,
      visibleText: searchDocumentText(visibleText),
      components: [component.name],
      states: uniqueSearchValues(component.variants.map(({ name }) => name)),
      layoutPatterns: uniqueSearchValues(component.responsiveBehavior ?? []),
      sourcePayload,
      searchText: searchDocumentText(
        component.name,
        aliases,
        component.description,
        source.version.app,
        source.version.categories,
        source.version.platform,
        visibleText,
        component.anatomy,
        component.responsiveBehavior,
      ),
    }));
  }

  const patterns = new Map<string, { name: string; imageIds: number[] }>();
  for (const image of source.images.filter(({ kind }) => kind === "screen")) {
    for (const name of image.analysis?.layoutPatterns ?? []) {
      const id = identityPart(name);
      const pattern = patterns.get(id) ?? { name: name.trim(), imageIds: [] };
      pattern.imageIds.push(image.id);
      patterns.set(id, pattern);
    }
  }
  for (const [id, pattern] of patterns) {
    const sourceId = `pattern:${appKey}:${id}`;
    documents.push(baseDocument(source, {
      documentId: sourceId,
      entityType: "pattern",
      sourceId,
      title: pattern.name,
      description: "",
      aliases: [],
      visibleText: "",
      components: [],
      states: [],
      layoutPatterns: [pattern.name],
      mediaImageId: pattern.imageIds[0],
      sourcePayload: {
        versionId: source.version.id,
        mediaImageId: pattern.imageIds[0],
        evidence: [...new Set(pattern.imageIds)].sort((a, b) => a - b),
      },
      searchText: searchDocumentText(
        pattern.name,
        source.version.app,
        source.version.categories,
        source.version.platform,
      ),
    }));
  }

  for (const flow of source.flows) {
    const sourceId = `flow:${appKey}:${identityPart(flow.id)}`;
    const evidence = [...new Set(flow.steps.flatMap(({ evidence: ids }) => ids))];
    documents.push(baseDocument(source, {
      documentId: sourceId,
      entityType: "flow",
      sourceId,
      title: flow.title,
      description: flow.description,
      aliases: uniqueSearchValues([flow.category, ...flow.tags]),
      visibleText: searchDocumentText(flow.steps.map(({ label }) => label)),
      flowId: flow.id,
      flowName: flow.title,
      components: [],
      states: [],
      layoutPatterns: [],
      ...(evidence[0] ? { mediaImageId: evidence[0] } : {}),
      sourcePayload: {
        versionId: source.version.id,
        flowId: flow.id,
        evidence,
        steps: flow.steps,
      },
      searchText: searchDocumentText(
        flow.title,
        flow.category,
        flow.description,
        flow.tags,
        flow.steps.flatMap(({ label, interaction }) => [label, interaction]),
        source.version.app,
        source.version.categories,
        source.version.platform,
      ),
    }));
  }

  return documents.sort((left, right) => {
    const entity = (ENTITY_ORDER.get(left.entityType) ?? 99) - (ENTITY_ORDER.get(right.entityType) ?? 99);
    if (entity !== 0) return entity;
    if (left.entityType === "component" && right.entityType === "component") {
      const subtype = Number(left.sourceId.startsWith("design-component:"))
        - Number(right.sourceId.startsWith("design-component:"));
      if (subtype !== 0) return subtype;
    }
    return left.sourceId.localeCompare(right.sourceId);
  });
}
