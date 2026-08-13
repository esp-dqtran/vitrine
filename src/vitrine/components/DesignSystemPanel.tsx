import { Spinner } from './Spinner.tsx';
import { Button, EmptyState, Text } from '@astryxdesign/core';
import type { DesignSystemSnapshot, EvidenceView, TokenKind } from '../../designSystem';
import { isActionableUsageRule } from '../../usagePatterns';
import type { UiElementSummaryItem } from '../appsApi.ts';
import type { DesignSystemGenerationView } from '../useDesignSystemGeneration.ts';
import { DESIGN_SYSTEM_REFERENCE_STYLES } from '../designSystemReferenceStyles.ts';
import { DesignSystemReferencePane } from './DesignSystemReferencePane.tsx';
import {
  ColorSection,
  ComponentSample,
  ComponentsSection,
  DesignSystemHeader,
  FoundationSection,
  KIND_LABELS,
  PatternsSection,
  pickShowcaseComponent,
  ThemeCanvas,
  titleCase,
  TypographySection,
} from './DesignSystemShowcase.tsx';

type Snapshot = DesignSystemSnapshot<EvidenceView>;

const markdownText = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

function canonicalProductCopy(value: string | undefined, productName: string): string | undefined {
  if (!value || productName.length < 4) return value;
  const stem = productName.slice(0, -1).toLocaleLowerCase();
  return value.replace(/\b[A-Za-z][A-Za-z0-9-]*\b/g, (word) => {
    if (word.toLocaleLowerCase() === productName.toLocaleLowerCase()) return word;
    return word.length === productName.length && word.slice(0, -1).toLocaleLowerCase() === stem
      ? productName
      : word;
  });
}

function snapshotWithCanonicalProductName(snapshot: Snapshot, productName: string): Snapshot {
  return {
    ...snapshot,
    app: productName,
    summary: canonicalProductCopy(snapshot.summary, productName),
    tokens: snapshot.tokens.map((token) => ({
      ...token,
      name: canonicalProductCopy(token.name, productName) ?? token.name,
      role: canonicalProductCopy(token.role, productName) ?? token.role,
    })),
    components: snapshot.components.map((component) => ({
      ...component,
      name: canonicalProductCopy(component.name, productName) ?? component.name,
      description: canonicalProductCopy(component.description, productName) ?? component.description,
      variants: component.variants.map((variant) => ({
        ...variant,
        name: canonicalProductCopy(variant.name, productName) ?? variant.name,
        description: canonicalProductCopy(variant.description, productName) ?? variant.description,
      })),
    })),
    rules: snapshot.rules?.map((rule) => ({
      ...rule,
      name: canonicalProductCopy(rule.name, productName) ?? rule.name,
      description: canonicalProductCopy(rule.description, productName) ?? rule.description,
    })),
  };
}

export function designSystemMarkdown(snapshot: Snapshot): string {
  const lines = [
    `# ${titleCase(snapshot.app)} Design System`,
    '',
    ...(snapshot.provenance?.northStar ? [`> ${snapshot.provenance.northStar}`, ''] : []),
    ...(snapshot.provenance?.theme ? [`**Theme:** ${snapshot.provenance.theme}`, ''] : []),
    snapshot.summary ?? 'A design system reconstructed from the available product evidence.',
    '',
  ];

  for (const kind of Object.keys(KIND_LABELS) as TokenKind[]) {
    const tokens = snapshot.tokens.filter((token) => token.kind === kind);
    if (!tokens.length) continue;
    lines.push(`## ${KIND_LABELS[kind]}`, '');
    for (const token of tokens) lines.push(`- **${markdownText(token.name)}**: \`${markdownText(token.value)}\` — ${markdownText(token.role)}`);
    lines.push('');
  }

  if (snapshot.components.length) {
    lines.push('## Components', '');
    for (const component of snapshot.components) {
      lines.push(`### ${markdownText(component.name)}`, '', markdownText(component.description), '');
      for (const variant of component.variants) lines.push(`- **${markdownText(variant.name)}**: ${markdownText(variant.description)}`);
      lines.push('');
    }
  }

  const rulesByKind = new Map<string, NonNullable<Snapshot['rules']>>();
  for (const rule of snapshot.rules ?? []) rulesByKind.set(rule.kind, [...(rulesByKind.get(rule.kind) ?? []), rule]);
  for (const [kind, rules] of rulesByKind) {
    lines.push(`## ${titleCase(kind)}`, '');
    for (const rule of rules) lines.push(`### ${markdownText(rule.name)}`, '', markdownText(rule.description), '');
  }

  return `${lines.join('\n').trim()}\n`;
}

function EvidenceLinks({ evidence }: { evidence: EvidenceView[] }) {
  if (!evidence.length) return null;
  return (
    <div className="ds-evidence">
      <Text as="div" type="supporting" color="secondary">{evidence.length} source screen{evidence.length === 1 ? '' : 's'}</Text>
      <div className="ds-evidence__links">
        {evidence.map((item) => (
          <a key={item.imageId} href={item.imageUrl} target="_blank" rel="noreferrer">Screen {item.imageId}</a>
        ))}
      </div>
    </div>
  );
}

function ComponentCropOverview(props: {
  appName: string;
  items: UiElementSummaryItem[];
  totalOccurrences: number;
  totalTypes: number;
}) {
  return (
    <section className="ds-crop-overview" aria-labelledby="component-crop-results">
      <header className="ds-crop-overview__header">
        <div>
          <span className="ds-page__eyebrow">Observed component library</span>
          <h2 id="component-crop-results">{titleCase(props.appName)} · Component Crop Results</h2>
          <p>
            {props.items.length >= props.totalTypes
              ? `All ${props.totalTypes.toLocaleString()} component types`
              : `${props.items.length.toLocaleString()} representative types`}
            {' '}from {props.totalOccurrences.toLocaleString()} extracted components
          </p>
        </div>
        <span className="ds-crop-overview__total">
          <strong>{props.totalTypes.toLocaleString()}</strong>
          total types
        </span>
      </header>
      <div className="ds-crop-overview__grid">
        {props.items.map((item) => (
          <article className="ds-crop-card" key={item.type}>
            <header>
              <strong>{item.type}</strong>
              <span>{item.count.toLocaleString()}</span>
            </header>
            <div className="ds-crop-card__preview">
              <img
                src={item.thumbnailUrl || item.imageUrl}
                alt={`${item.type} representative crop`}
                loading="lazy"
              />
            </div>
            <footer>
              <span>{item.group}</span>
              {item.visibleStates[0] ? <span>{item.visibleStates[0]}</span> : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

interface DesignSystemPanelProps {
  snapshot: Snapshot | null;
  status: 'loading' | 'ready' | 'missing' | 'error';
  showReviewMetadata?: boolean;
  generation?: DesignSystemGenerationView | null;
  onRetryGeneration?: () => void;
  appName?: string;
  componentCrops?: UiElementSummaryItem[];
  totalComponentOccurrences?: number;
  totalComponentTypes?: number;
}

function GenerationBanner(props: {
  generation: DesignSystemGenerationView;
  onRetry?: () => void;
}) {
  const { generation } = props;
  const { job } = generation;
  const messages: Record<DesignSystemGenerationView['phase'], string> = {
    queued: 'Waiting for analysis worker',
    analyzing: `Analyzing Screens · ${job.doneCount}/${job.totalCount}`,
    synthesizing: `Extracting design system · ${job.synthesisDoneCount}/${job.synthesisTotalCount}`,
    merging: 'Merging extracted design evidence',
    saving: 'Saving Design System draft',
    draft_ready: 'Draft ready for review',
    failed: 'Analysis failed',
    stale: 'Capture changed during analysis',
  };
  const partial = generation.coverage
    && (generation.coverage.failed > 0 || generation.coverage.quarantined > 0)
    ? `${generation.coverage.failed} failed · ${generation.coverage.quarantined} quarantined`
    : undefined;
  return (
    <aside className={`ds-generation ds-generation--${generation.phase}`} role="status">
      <div>
        <strong>{messages[generation.phase]}</strong>
        {generation.regenerating && generation.phase !== 'draft_ready'
          ? <span>Refreshing the existing Design System</span>
          : null}
        {partial ? <span>{partial}</span> : null}
        {generation.phase === 'draft_ready'
          ? <span>LLM-inferred candidates need human review before publication.</span>
          : null}
      </div>
      {(generation.phase === 'failed' || generation.phase === 'stale') && props.onRetry
        ? <Button label="Retry analysis" size="sm" clickAction={props.onRetry} />
        : null}
    </aside>
  );
}

function DesignSystemTrustSummary({ snapshot }: { snapshot: Snapshot }) {
  const candidates = [
    ...snapshot.tokens,
    ...snapshot.components.flatMap((component) => component.variants),
    ...(snapshot.rules ?? []),
  ];
  const evidenceLinks = candidates.reduce((total, candidate) => total + candidate.evidence.length, 0);
  const inferred = candidates.filter((candidate) => candidate.source === 'llm_inferred').length;
  const reviewed = candidates.filter((candidate) => candidate.reviewStatus === 'reviewed').length;
  const needsReview = candidates.filter((candidate) => candidate.reviewStatus === 'needs_review').length;

  return (
    <aside className="ds-trust" aria-labelledby="design-system-trust-title">
      <div className="ds-trust__copy">
        <span className="ds-page__eyebrow">Evidence and review</span>
        <h3 id="design-system-trust-title">How to read this Design System</h3>
        <p>
          Source links are captured product evidence. Inferred previews and candidate names are AI reconstructions,
          not canonical source UI. Verify a source screen before using an unreviewed value.
        </p>
      </div>
      <dl className="ds-trust__stats">
        <div><dt>Evidence links</dt><dd>{evidenceLinks.toLocaleString()}</dd></div>
        <div><dt>AI-inferred</dt><dd>{inferred.toLocaleString()}</dd></div>
        <div><dt>Reviewed</dt><dd>{reviewed.toLocaleString()}</dd></div>
        <div><dt>Needs review</dt><dd>{needsReview.toLocaleString()}</dd></div>
      </dl>
    </aside>
  );
}

export function DesignSystemPanel({
  snapshot,
  status,
  showReviewMetadata = false,
  generation,
  onRetryGeneration,
  appName,
  componentCrops = [],
  totalComponentOccurrences = 0,
  totalComponentTypes = 0,
}: DesignSystemPanelProps) {
  const renderEvidence = (evidence: EvidenceView[]) => <EvidenceLinks evidence={evidence} />;
  const cropOverview = componentCrops.length ? (
    <ComponentCropOverview
      appName={appName ?? snapshot?.app ?? 'App'}
      items={componentCrops}
      totalOccurrences={totalComponentOccurrences}
      totalTypes={totalComponentTypes}
    />
  ) : null;

  if (status === 'loading' && !snapshot && !generation && !cropOverview) return <Spinner size="lg" />;
  if (!snapshot) {
    if (cropOverview) {
      return (
        <div className="ds-page">
          {generation ? <GenerationBanner generation={generation} onRetry={onRetryGeneration} /> : null}
          {cropOverview}
        </div>
      );
    }
    return (
      <>
        {generation ? <GenerationBanner generation={generation} onRetry={onRetryGeneration} /> : null}
        <EmptyState title="No design system yet" description="No design-system data is available for this app." headingLevel={2} />
      </>
    );
  }

  const displayName = appName ?? snapshot.app;
  const displaySnapshot = snapshotWithCanonicalProductName(snapshot, displayName);
  const tokenGroups = (Object.keys(KIND_LABELS) as TokenKind[])
    .map((kind) => [kind, displaySnapshot.tokens.filter((token) => token.kind === kind)] as const)
    .filter(([, tokens]) => tokens.length > 0);
  const hasComponents = displaySnapshot.components.length > 0;
  const usageRules = (displaySnapshot.rules ?? []).filter(isActionableUsageRule);
  const hasRules = usageRules.length > 0;
  const showcase = pickShowcaseComponent(displaySnapshot.components);

  if (!tokenGroups.length && !hasComponents && !hasRules) {
    if (cropOverview) return <div className="ds-page">{cropOverview}</div>;
    return <EmptyState title="No design system available" description="No design tokens, components, or rules are available for this app." headingLevel={2} />;
  }

  let sectionIndex = 0;
  const screenshot = displaySnapshot.provenance?.screenshotUrl ?? displaySnapshot.provenance?.thumbnailUrl;
  const isRefero = displaySnapshot.provenance?.provider === 'refero';
  const isGetDesign = displaySnapshot.provenance?.provider === 'getdesign'
    || displaySnapshot.components.some((component) => /imported from the GetDesign system/i.test(component.description));
  const isExternal = isRefero || isGetDesign;
  const hasAiInferences = [
    ...displaySnapshot.tokens,
    ...displaySnapshot.components.flatMap((component) => component.variants),
    ...(displaySnapshot.rules ?? []),
  ].some((candidate) => candidate.source === 'llm_inferred');
  const resolveCropUrl = (variant: Snapshot['components'][number]['variants'][number]) =>
    variant.occurrences?.find((occurrence) => occurrence.crop)?.crop?.imageUrl;
  return (
    <div className="ds-page">
      <style>{DESIGN_SYSTEM_REFERENCE_STYLES}</style>
      {generation ? <GenerationBanner generation={generation} onRetry={onRetryGeneration} /> : null}
      <DesignSystemHeader
        eyebrow={isExternal ? 'Imported style reference' : 'Design system analysis'}
        title={titleCase(displayName)}
        summary={displaySnapshot.summary ?? 'A living styleguide reconstructed from the available product evidence.'}
        sourceLabel={isExternal
          ? `${isRefero ? 'Refero' : 'GetDesign'} source · External import`
          : hasAiInferences
            ? 'Vitrines · Evidence-backed AI analysis'
            : 'Vitrines · Observed evidence'}
        originalUrl={displaySnapshot.provenance?.originalUrl}
        sourceUrl={displaySnapshot.provenance?.sourceUrl}
        tokenCount={displaySnapshot.tokens.length}
        componentCount={displaySnapshot.components.length}
        patternCount={usageRules.length}
      />
      {!isExternal ? <DesignSystemTrustSummary snapshot={displaySnapshot} /> : null}

      <div className="ds-refero-layout">
        <div className="ds-refero-reference">
          {screenshot ? <figure className="ds-refero-hero"><img src={screenshot} alt={`${titleCase(displayName)} source website`} /></figure> : null}
          {cropOverview}
          <ThemeCanvas
            title={`${titleCase(displayName)} foundations & components`}
            description="Visual specimens reconstructed from the design tokens, component definitions, and product rules available in Vitrines."
            showcase={showcase
              ? <ComponentSample componentName={showcase.component.name} variant={showcase.variant} resolveCropUrl={resolveCropUrl} />
              : undefined}
          >
            {tokenGroups.map(([kind, tokens]) => {
              sectionIndex += 1;
              if (kind === 'color') return <ColorSection key={kind} index={sectionIndex} tokens={tokens} renderEvidence={renderEvidence} showReviewMetadata={showReviewMetadata} />;
              if (kind === 'typography') return <TypographySection key={kind} index={sectionIndex} tokens={tokens} showReviewMetadata={showReviewMetadata} />;
              return <FoundationSection key={kind} index={sectionIndex} kind={kind} tokens={tokens} renderEvidence={renderEvidence} showReviewMetadata={showReviewMetadata} />;
            })}
            {hasComponents ? <ComponentsSection index={(sectionIndex += 1)} components={displaySnapshot.components} renderEvidence={renderEvidence} resolveCropUrl={resolveCropUrl} showReviewMetadata={showReviewMetadata} /> : null}
            {hasRules ? <PatternsSection index={(sectionIndex += 1)} rules={usageRules} renderEvidence={renderEvidence} showReviewMetadata={showReviewMetadata} /> : null}
          </ThemeCanvas>
        </div>
        <DesignSystemReferencePane snapshot={displaySnapshot} markdown={designSystemMarkdown(displaySnapshot)} />
      </div>
    </div>
  );
}
