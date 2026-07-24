import { createHash } from "node:crypto";
import type {
  AppKnowledgeComponentCandidate,
  AppKnowledgeComponentVariant,
} from "./appKnowledge.ts";
import type { AppKnowledgeRevisionView } from "./appKnowledgeStore.ts";
import type {
  AppKnowledgeEvidenceManifestItem,
} from "./appKnowledgeEvidence.ts";
import type {
  DesignComponent,
  DesignFlow,
  DesignSystemSnapshot,
  DesignToken,
  EvidenceOccurrence,
} from "./designSystem.ts";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function digest(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 20);
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}-${digest(parts)}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function occurrenceRegionKey(
  region: { x: number; y: number; width: number; height: number },
): string {
  return [region.x, region.y, region.width, region.height].join(",");
}

export function componentOccurrenceKey(input: {
  componentId: string;
  variantId: string;
  evidenceId: string;
  region: { x: number; y: number; width: number; height: number };
}): string {
  return [
    input.componentId,
    input.variantId,
    input.evidenceId,
    occurrenceRegionKey(input.region),
  ].join("\0");
}

function manifestIndex(
  manifest: readonly AppKnowledgeEvidenceManifestItem[],
): Map<string, AppKnowledgeEvidenceManifestItem> {
  const result = new Map<string, AppKnowledgeEvidenceManifestItem>();
  for (const item of manifest) {
    if (result.has(item.evidenceId)) {
      throw new Error(`Duplicate evidence in frozen manifest: ${item.evidenceId}`);
    }
    result.set(item.evidenceId, item);
  }
  return result;
}

function imageIds(
  evidenceIds: readonly string[],
  manifest: ReadonlyMap<string, AppKnowledgeEvidenceManifestItem>,
  label: string,
  kind?: AppKnowledgeEvidenceManifestItem["kind"],
): number[] {
  const result = evidenceIds.map((evidenceId) => {
    const item = manifest.get(evidenceId);
    if (!item) throw new Error(`${label} cites evidence absent from the frozen manifest: ${evidenceId}`);
    if (kind && item.kind !== kind) {
      throw new Error(`${label} requires ${kind} evidence: ${evidenceId}`);
    }
    return item.imageId;
  });
  return [...new Set(result)].sort((left, right) => left - right);
}

function viewportIndex(
  revision: AppKnowledgeRevisionView,
): Map<string, string> {
  return new Map(revision.content.screens.map(({ evidenceId, viewport }) => [
    evidenceId,
    viewport,
  ]));
}

function viewports(
  evidenceIds: readonly string[],
  byEvidence: ReadonlyMap<string, string>,
): string[] {
  return uniqueSorted(evidenceIds.flatMap((evidenceId) => {
    const viewport = byEvidence.get(evidenceId);
    return viewport && viewport !== "unknown" ? [viewport] : [];
  }));
}

function projectVariant(input: {
  component: AppKnowledgeComponentCandidate;
  variant: AppKnowledgeComponentVariant;
  manifest: ReadonlyMap<string, AppKnowledgeEvidenceManifestItem>;
  viewports: ReadonlyMap<string, string>;
  crops: ReadonlyMap<string, number>;
}): DesignComponent["variants"][number] {
  const occurrences: EvidenceOccurrence[] = input.variant.occurrences
    .map((occurrence) => {
      const [imageId] = imageIds(
        [occurrence.evidenceId],
        input.manifest,
        `Component ${input.component.name} variant ${input.variant.name}`,
        "screen",
      );
      const key = componentOccurrenceKey({
        componentId: input.component.id,
        variantId: input.variant.id,
        evidenceId: occurrence.evidenceId,
        region: occurrence.region,
      });
      const cropImageId = input.crops.get(key);
      return {
        imageId,
        region: occurrence.region,
        coordinateSpace: "normalized" as const,
        ...(cropImageId ? { cropImageId } : {}),
        confidence: occurrence.confidence,
      };
    })
    .sort((left, right) =>
      left.imageId - right.imageId
      || occurrenceRegionKey(left.region!).localeCompare(occurrenceRegionKey(right.region!)));
  return {
    id: stableId("variant", [
      normalized(input.component.name),
      normalized(input.variant.name),
      uniqueSorted(input.variant.observedProperties.map(normalized)),
    ]),
    name: input.variant.name,
    description: input.variant.description,
    evidence: imageIds(
      input.variant.evidenceIds,
      input.manifest,
      `Component ${input.component.name} variant ${input.variant.name}`,
      "screen",
    ),
    observedProperties: uniqueSorted(input.variant.observedProperties),
    observedStates: uniqueSorted(input.variant.visibleStates),
    confidence: input.variant.confidence,
    reviewStatus: "needs_review",
    responsiveViewports: viewports(input.variant.evidenceIds, input.viewports),
    occurrences,
    source: "llm_inferred",
  };
}

function fallbackVariants(input: {
  component: AppKnowledgeComponentCandidate;
  manifest: ReadonlyMap<string, AppKnowledgeEvidenceManifestItem>;
  viewports: ReadonlyMap<string, string>;
}): DesignComponent["variants"] {
  const names = input.component.variants.length > 0
    ? input.component.variants
    : ["Observed"];
  return uniqueSorted(names).map((name) => ({
    id: stableId("variant", [normalized(input.component.name), normalized(name)]),
    name,
    description: input.component.purpose,
    evidence: imageIds(
      input.component.evidenceIds,
      input.manifest,
      `Component ${input.component.name}`,
      "screen",
    ),
    observedProperties: uniqueSorted(input.component.observedProperties),
    observedStates: uniqueSorted(input.component.states),
    confidence: input.component.confidence,
    reviewStatus: "needs_review" as const,
    responsiveViewports: viewports(input.component.evidenceIds, input.viewports),
    occurrences: [],
    source: "llm_inferred" as const,
  }));
}

function projectFlows(
  revision: AppKnowledgeRevisionView,
  manifest: ReadonlyMap<string, AppKnowledgeEvidenceManifestItem>,
): DesignFlow[] {
  return [...revision.content.flows]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((flow) => ({
      id: flow.sourceFlowId,
      title: flow.title,
      ...(flow.category ? { category: flow.category } : {}),
      description: flow.userGoal.text,
      tags: uniqueSorted(flow.category ? [flow.category] : []),
      steps: [...flow.steps]
        .sort((left, right) => left.order - right.order)
        .map((step) => ({
          label: step.label,
          evidence: imageIds(
            [step.evidenceId],
            manifest,
            `Flow ${flow.sourceFlowId} step ${step.id}`,
            "flow_step",
          ),
        })),
    }));
}

export function projectAppKnowledgeDesignSystem(
  revision: AppKnowledgeRevisionView,
  crops: ReadonlyMap<string, number> = new Map(),
): DesignSystemSnapshot {
  const manifest = manifestIndex(revision.manifest);
  const viewportByEvidence = viewportIndex(revision);
  const tokens: DesignToken[] = (revision.content.tokenCandidates ?? [])
    .map((token) => ({
      id: stableId(token.kind, [
        token.kind,
        normalized(token.name),
        normalized(token.role),
        normalized(token.value),
      ]),
      kind: token.kind,
      name: token.name,
      value: token.value,
      role: token.role,
      evidence: imageIds(
        token.evidenceIds,
        manifest,
        `Token ${token.name}`,
        "screen",
      ),
      confidence: token.confidence,
      reviewStatus: "needs_review" as const,
      responsiveViewports: viewports(token.evidenceIds, viewportByEvidence),
      source: "llm_inferred" as const,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const tokenIdByCandidate = new Map(
    (revision.content.tokenCandidates ?? []).map((candidate) => {
      const projected = tokens.find(({ name, value, role }) =>
        name === candidate.name && value === candidate.value && role === candidate.role);
      return [candidate.id, projected?.id] as const;
    }),
  );
  const components: DesignComponent[] = [...revision.content.componentCandidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((component) => ({
      id: stableId("component", [
        normalized(component.name),
        normalized(component.category),
        normalized(component.purpose),
      ]),
      name: component.name,
      category: component.category,
      description: component.purpose,
      anatomy: uniqueSorted(component.anatomy),
      associatedTokenIds: uniqueSorted(component.designLanguageCandidateIds.flatMap((id) => {
        const tokenId = tokenIdByCandidate.get(id);
        return tokenId ? [tokenId] : [];
      })),
      responsiveBehavior: uniqueSorted(component.responsiveEvidence),
      variants: component.variantCandidates.length > 0
        ? [...component.variantCandidates]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((variant) => projectVariant({
              component,
              variant,
              manifest,
              viewports: viewportByEvidence,
              crops,
            }))
        : fallbackVariants({ component, manifest, viewports: viewportByEvidence }),
    }));
  const rules = (revision.content.designRules ?? [])
    .map((rule) => ({
      id: stableId(rule.kind, [
        rule.kind,
        normalized(rule.name),
        normalized(rule.description),
      ]),
      kind: rule.kind,
      name: rule.name,
      description: rule.description,
      evidence: imageIds(
        rule.evidenceIds,
        manifest,
        `Rule ${rule.name}`,
        "screen",
      ),
      confidence: rule.confidence,
      reviewStatus: "needs_review" as const,
      source: "llm_inferred" as const,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    app: revision.content.identity.app,
    generatedAt: revision.content.identity.generatedAt,
    summary: `LLM-inferred design system from ${revision.content.coverage.analyzed + revision.content.coverage.cached} verified captures.`,
    tokens,
    components,
    flows: projectFlows(revision, manifest),
    rules,
  };
}
