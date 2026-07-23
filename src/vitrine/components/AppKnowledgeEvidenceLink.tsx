import type { AppKnowledgeEvidenceManifestItem } from '../../appKnowledgeEvidence.ts';
import type { Platform } from '../../platformFromUrl.ts';
import type { AppKnowledgeEvidenceReference } from '../appKnowledgeApi.ts';
import { routeToPath } from '../router.ts';

type EvidenceReference =
  | AppKnowledgeEvidenceReference
  | Pick<AppKnowledgeEvidenceManifestItem, 'evidenceId' | 'imageId' | 'kind' | 'flow'>;

export function appKnowledgeEvidencePath(input: {
  app: string;
  platform: Platform;
  version?: number;
  evidenceId: string;
  manifest: EvidenceReference[];
}): string | undefined {
  const evidence = input.manifest.find(({ evidenceId }) => evidenceId === input.evidenceId);
  if (!evidence) return undefined;
  if (evidence.kind === 'flow_step' && evidence.flow) {
    return routeToPath({
      name: 'app',
      appId: input.app,
      section: 'flows',
      platform: input.platform,
      version: input.version,
      flow: evidence.flow.id,
      step: evidence.flow.stepIndex + 1,
    });
  }
  return routeToPath({
    name: 'app',
    appId: input.app,
    section: evidence.kind === 'ui_element' ? 'elements' : 'screens',
    platform: input.platform,
    version: input.version,
    evidence: evidence.evidenceId,
  });
}

export function AppKnowledgeEvidenceLink(props: {
  app: string;
  platform: Platform;
  version?: number;
  evidenceId: string;
  manifest: EvidenceReference[];
}) {
  const href = appKnowledgeEvidencePath(props);
  if (!href) {
    return (
      <span style={{ color: 'var(--color-text-disabled)', fontSize: 12 }}>
        {props.evidenceId} (unavailable)
      </span>
    );
  }
  return (
    <a
      href={href}
      style={{
        color: 'var(--color-text-link, var(--color-accent))',
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {props.evidenceId}
    </a>
  );
}
