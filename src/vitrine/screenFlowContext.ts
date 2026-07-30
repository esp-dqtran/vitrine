import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { Screen } from './types.ts';

export interface ScreenFlowReference {
  id: string;
  title: string;
}

export function buildScreenFlowMembership(
  flows: readonly DesignFlow<EvidenceView>[],
): Map<number, ScreenFlowReference[]> {
  const membership = new Map<number, ScreenFlowReference[]>();
  for (const flow of flows) {
    const imageIds = new Set(flow.steps.flatMap((step) =>
      step.evidence.map(({ imageId }) => imageId)));
    for (const imageId of imageIds) {
      membership.set(imageId, [
        ...(membership.get(imageId) ?? []),
        { id: flow.id, title: flow.title },
      ]);
    }
  }
  return membership;
}

export function rankHighlightedScreens(
  screens: readonly Screen[],
  membership: ReadonlyMap<number, readonly ScreenFlowReference[]>,
  limit = 9,
): Screen[] {
  return screens
    .map((screen, position) => ({
      screen,
      position,
      flowCount: membership.get(screen.id)?.length ?? 0,
    }))
    .filter(({ flowCount }) => flowCount > 0)
    .sort((left, right) =>
      right.flowCount - left.flowCount || left.position - right.position)
    .slice(0, limit)
    .map(({ screen }) => screen);
}

export function rankFlowsForScreens(
  flows: readonly DesignFlow<EvidenceView>[],
  screens: readonly Screen[],
  limit = 2,
): DesignFlow<EvidenceView>[] {
  const screenIds = new Set(screens.map(({ id }) => id));
  return flows
    .map((flow, position) => ({
      flow,
      position,
      matches: new Set(flow.steps.flatMap((step) =>
        step.evidence
          .map(({ imageId }) => imageId)
          .filter((imageId) => screenIds.has(imageId)))).size,
    }))
    .filter(({ matches }) => matches > 0)
    .sort((left, right) =>
      right.matches - left.matches
      || right.flow.steps.length - left.flow.steps.length
      || left.position - right.position)
    .slice(0, limit)
    .map(({ flow }) => flow);
}
