import type { DesignFlow, EvidenceView } from '../designSystem.ts';
import type { Screen } from './types.ts';

export interface ScreenFilterSelections {
  types: string[];
  layouts: string[];
  components: string[];
  states: string[];
}

export const EMPTY_SCREEN_FILTERS: ScreenFilterSelections = {
  types: [],
  layouts: [],
  components: [],
  states: [],
};

export interface FlowFilterSelections {
  categories: string[];
  tags: string[];
  interactions: string[];
  states: string[];
}

export const EMPTY_FLOW_FILTERS: FlowFilterSelections = {
  categories: [],
  tags: [],
  interactions: [],
  states: [],
};

export function screenMatchesFilters(screen: Screen, selected: ScreenFilterSelections) {
  return (
    (!selected.types.length || selected.types.includes(screen.type))
    && (!selected.layouts.length || selected.layouts.some((value) => screen.layoutPatterns?.includes(value)))
    && (!selected.components.length || selected.components.some((value) => screen.componentNames?.includes(value)))
    && (!selected.states.length || selected.states.some((value) => screen.visibleStates.includes(value)))
  );
}

export function flowFilterValues(flow: DesignFlow<EvidenceView>) {
  return {
    categories: flow.category ? [flow.category] : [],
    tags: flow.tags,
    interactions: flow.steps.flatMap((step) => [
      ...(step.interaction ? [step.interaction] : []),
      ...(step.analysis?.interaction ? [step.analysis.interaction] : []),
    ]),
    states: flow.steps.flatMap((step) => step.analysis?.visibleStates ?? []),
  };
}

export function flowMatchesFilters(
  flow: DesignFlow<EvidenceView>,
  selected: FlowFilterSelections,
) {
  const values = flowFilterValues(flow);
  return (
    (!selected.categories.length || selected.categories.some((value) => values.categories.includes(value)))
    && (!selected.tags.length || selected.tags.some((value) => values.tags.includes(value)))
    && (!selected.interactions.length || selected.interactions.some((value) => values.interactions.includes(value)))
    && (!selected.states.length || selected.states.some((value) => values.states.includes(value)))
  );
}
