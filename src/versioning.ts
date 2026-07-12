import type { DesignFlow, DesignSystemSnapshot } from './designSystem.ts';

export type AppVersionStatus = 'draft' | 'in_review' | 'published' | 'archived';

export interface PublicationBlocker {
  code: 'screens_missing' | 'screen_analysis_missing' | 'design_system_missing' | 'invalid_evidence';
  message: string;
}

export interface PublicationCandidate {
  images: Array<{ id: number; analysis?: unknown | null }>;
  snapshot?: DesignSystemSnapshot;
  flows: DesignFlow[];
}

export function canTransitionVersion(from: AppVersionStatus, to: AppVersionStatus): boolean {
  return (from === 'draft' && to === 'in_review') || (from === 'in_review' && to === 'published') || (from === 'published' && to === 'archived');
}

export function validatePublication({ images, snapshot, flows }: PublicationCandidate): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = [];
  if (images.length === 0) blockers.push({ code: 'screens_missing', message: 'Capture at least one web screen.' });
  else if (images.some(({ analysis }) => !analysis)) blockers.push({ code: 'screen_analysis_missing', message: 'Every captured screen must complete structured analysis.' });
  if (!snapshot) blockers.push({ code: 'design_system_missing', message: 'Complete structured design-system synthesis.' });
  if (!snapshot) return blockers;

  const ids = new Set(images.map(({ id }) => id));
  const evidenceSets = [
    ...snapshot.tokens.map(({ evidence }) => evidence),
    ...snapshot.components.flatMap(({ variants }) => variants.map(({ evidence }) => evidence)),
    ...(snapshot.rules ?? []).map(({ evidence }) => evidence),
    ...flows.flatMap(({ steps }) => steps.map(({ evidence }) => evidence)),
  ];
  if (evidenceSets.some((evidence) => evidence.length === 0 || evidence.some((id) => !ids.has(id)))) {
    blockers.push({ code: 'invalid_evidence', message: 'Every token, variant, and flow step must reference a screen in this version.' });
  }
  const duplicateVariantProperties = snapshot.components.some(({ variants }) => {
    const signatures = variants.map(({ observedProperties }) => observedProperties?.slice().sort().join('|')).filter(Boolean) as string[];
    return signatures.length > 1 && new Set(signatures).size !== signatures.length;
  });
  if (duplicateVariantProperties && !blockers.some(({ code }) => code === 'invalid_evidence')) blockers.push({ code: 'invalid_evidence', message: 'Observed variants must differ by at least one reviewed property.' });
  return blockers;
}

export function markSnapshotReviewed(snapshot: DesignSystemSnapshot): DesignSystemSnapshot {
  return {
    ...snapshot,
    tokens: snapshot.tokens.map((token) => ({ ...token, reviewStatus: 'reviewed' })),
    components: snapshot.components.map((component) => ({
      ...component,
      variants: component.variants.map((variant) => ({ ...variant, reviewStatus: 'reviewed' })),
    })),
    rules: snapshot.rules?.map((rule) => ({ ...rule, reviewStatus: 'reviewed' })),
  };
}
