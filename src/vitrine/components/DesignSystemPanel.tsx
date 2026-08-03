import { useState, type CSSProperties } from 'react';
import { Badge, Button, EmptyState, SegmentedControl, SegmentedControlItem, Spinner, Text, TextInput } from '@astryxdesign/core';
import type { ComponentVariant, DesignSystemSnapshot, EvidenceView, ReviewStatus, TokenKind } from '../../designSystem';
import { isActionableUsageRule, usagePatternSummary } from '../../usagePatterns';
import type { UiElementSummaryItem } from '../appsApi.ts';
import type { DesignSystemGenerationView } from '../useDesignSystemGeneration.ts';
import { DESIGN_SYSTEM_REFERENCE_STYLES } from '../designSystemReferenceStyles.ts';
import { DesignSystemReferencePane } from './DesignSystemReferencePane.tsx';

const KIND_LABELS: Record<TokenKind, string> = {
  color: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radii',
  border: 'Borders',
  effect: 'Effects',
};

const SECTION_LABELS: Record<TokenKind, string> = {
  color: 'Color palette',
  typography: 'Typography scale',
  spacing: 'Spacing rhythm',
  radius: 'Corner radii',
  border: 'Border styles',
  effect: 'Effects & elevation',
};

const REVIEW_VARIANT: Record<ReviewStatus, 'success' | 'warning' | 'error'> = {
  reviewed: 'success',
  needs_review: 'warning',
  rejected: 'error',
};

type Snapshot = DesignSystemSnapshot<EvidenceView>;
type Token = Snapshot['tokens'][number];

const titleCase = (value: string) => value
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const pxValue = (value: string): number | undefined => {
  const match = /(-?\d+(?:\.\d+)?)\s*px/.exec(value);
  return match ? Number(match[1]) : undefined;
};

const typographyProperty = (value: string, property: string): string | undefined => {
  const match = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(value);
  return match?.[1]?.trim();
};

const safeColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return /^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[a-z]+$|var\()/i.test(value.trim()) ? value.trim() : fallback;
};

const markdownText = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');

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

function ReviewFooter({ confidence, reviewStatus }: { confidence?: number; reviewStatus?: ReviewStatus }) {
  if (confidence == null && !reviewStatus) return null;
  return (
    <div className="ds-review">
      {reviewStatus ? <Badge variant={REVIEW_VARIANT[reviewStatus]} label={reviewStatus === 'reviewed' ? 'Reviewed' : reviewStatus === 'rejected' ? 'Rejected' : 'Needs review'} /> : null}
      {confidence != null ? <Text type="supporting" color="secondary">{Math.round(confidence * 100)}% confidence</Text> : null}
    </div>
  );
}

function SectionHeading({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <header className="ds-section__heading">
      <span>{String(index).padStart(2, '0')}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </header>
  );
}

function TokenMeta({ token }: { token: Token }) {
  return (
    <div className="ds-token__meta">
      <div className="ds-token__name">{token.name}</div>
      <code>{token.value}</code>
      <p>{token.role}</p>
      <EvidenceLinks evidence={token.evidence} />
      <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} />
    </div>
  );
}

function ColorSection({ index, tokens }: { index: number; tokens: Token[] }) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Color palette" description="Core colors and the roles they play across the product." />
      <div className="ds-colors">
        {tokens.map((token) => (
          <article className="ds-color" key={token.id}>
            <div className="ds-color__swatch" style={{ background: safeColor(token.value, 'var(--ds-muted)') }} />
            <TokenMeta token={token} />
          </article>
        ))}
      </div>
    </section>
  );
}

function TypographySection({ index, tokens }: { index: number; tokens: Token[] }) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Typography scale" description="Type roles shown at their extracted size, weight, and rhythm." />
      <div className="ds-type-list">
        {tokens.map((token) => {
          const size = Math.min(Number.parseFloat(typographyProperty(token.value, 'font-size') ?? '') || pxValue(token.value) || 18, 64);
          const weight = typographyProperty(token.value, 'font-weight');
          const lineHeight = typographyProperty(token.value, 'line-height');
          const family = typographyProperty(token.value, 'font-family');
          return (
            <article className="ds-type" key={token.id}>
              <div className="ds-type__sample" style={{ fontSize: size, fontWeight: weight, lineHeight, fontFamily: family }}>{token.name}</div>
              <TokenMeta token={token} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FoundationSample({ token }: { token: Token }) {
  const amount = Math.max(2, Math.min(pxValue(token.value) ?? 16, 144));
  if (token.kind === 'spacing') return <div className="ds-foundation__spacing" style={{ width: amount }} />;
  if (token.kind === 'radius') return <div className="ds-foundation__shape" style={{ borderRadius: amount }} />;
  if (token.kind === 'border') return <div className="ds-foundation__shape" style={{ borderWidth: Math.min(amount, 8) }} />;
  return <div className="ds-foundation__effect" style={{ boxShadow: token.value }} />;
}

function FoundationSection({ index, kind, tokens }: { index: number; kind: TokenKind; tokens: Token[] }) {
  const descriptions: Partial<Record<TokenKind, string>> = {
    spacing: 'A consistent spacing rhythm for layout and controls.',
    radius: 'Corner treatments used to shape product surfaces.',
    border: 'Stroke treatments that separate and define surfaces.',
    effect: 'Elevation and visual effects used to establish depth.',
  };
  return (
    <section className="ds-section">
      <SectionHeading index={index} title={SECTION_LABELS[kind]} description={descriptions[kind] ?? 'Extracted foundation tokens.'} />
      <div className="ds-foundations">
        {tokens.map((token) => (
          <article className="ds-foundation" key={token.id}>
            <div className="ds-foundation__preview"><FoundationSample token={token} /></div>
            <TokenMeta token={token} />
          </article>
        ))}
      </div>
    </section>
  );
}

function reconstructionStyle(spec: ComponentVariant<EvidenceView>['reconstruction']): CSSProperties {
  return {
    background: safeColor(spec?.fill, 'var(--ds-accent)'),
    borderColor: safeColor(spec?.stroke, 'transparent'),
    borderRadius: spec?.radius ?? 8,
    padding: spec?.padding ?? 12,
    gap: spec?.gap ?? 8,
    width: spec?.width,
    minHeight: spec?.height,
  };
}

function ComponentSample({ componentName, variant }: { componentName: string; variant: ComponentVariant<EvidenceView> }) {
  const crop = variant.occurrences?.find((occurrence) => occurrence.crop)?.crop;
  if (crop) {
    return (
      <figure className="ds-specimen">
        <img src={crop.imageUrl} alt={`${componentName} ${variant.name}`} />
        <figcaption>Observed specimen</figcaption>
      </figure>
    );
  }
  const kind = componentName.toLowerCase();
  const label = variant.reconstruction?.visibleText || (variant.name.toLowerCase() === 'default' ? componentName : variant.name);
  const style = reconstructionStyle(variant.reconstruction);
  let preview;
  if (/market.*table|table.*card/.test(kind)) {
    preview = (
      <div className="ds-sample-market" style={style}>
        <div className="ds-sample-market__tabs"><strong>Popular</strong><span>New listings</span><span>Top gainers</span></div>
        <table>
          <tbody>
            <tr><th>BTC/USDT</th><td>78,065.04</td><td>+1.42%</td></tr>
            <tr><th>ETH/USDT</th><td>3,219.18</td><td>+0.85%</td></tr>
            <tr><th>SOL/USDT</th><td>162.40</td><td className="is-down">-2.31%</td></tr>
          </tbody>
        </table>
      </div>
    );
  } else if (/input|field|search/.test(kind)) {
    preview = <div className="ds-sample-field"><TextInput label={componentName} value={label} onChange={() => undefined} width="100%" /></div>;
  } else if (/badge|chip|tag/.test(kind)) {
    preview = <span className="ds-sample-badge" style={style}>{label}</span>;
  } else if (/card|panel|tile/.test(kind)) {
    preview = <article className="ds-sample-card" style={style}><strong>{label}</strong><span>{variant.description}</span></article>;
  } else if (/nav|tab|menu/.test(kind)) {
    preview = <nav className="ds-sample-nav"><Button label={label} className="is-active" size="sm" /><Button label="Overview" variant="ghost" size="sm" /><Button label="Activity" variant="ghost" size="sm" /></nav>;
  } else {
    preview = <Button label={label} className="ds-sample-button" style={style} />;
  }
  return <div className="ds-inferred-preview">{preview}<small>Inferred preview</small></div>;
}

function ComponentsSection({ index, components }: { index: number; components: Snapshot['components'] }) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Component gallery" description="Reusable interface patterns rendered in their available variants." />
      <div className="ds-components">
        {components.map((component) => (
          <article className="ds-component" key={component.id}>
            <header>
              <div><span>{component.category}</span><h4>{component.name}</h4></div>
              <p>{component.description}</p>
            </header>
            <div className="ds-component__variants">
              {component.variants.map((variant) => (
                <div className="ds-variant" key={variant.id}>
                  <div className="ds-variant__stage"><ComponentSample componentName={component.name} variant={variant} /></div>
                  <div className="ds-variant__meta">
                    <strong>{variant.name}</strong>
                    <p>{variant.description}</p>
                    <EvidenceLinks evidence={variant.evidence} />
                    <ReviewFooter confidence={variant.confidence} reviewStatus={variant.reviewStatus} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PatternsSection({ index, rules }: { index: number; rules: NonNullable<Snapshot['rules']> }) {
  const byKind = new Map<string, typeof rules>();
  for (const rule of rules) byKind.set(rule.kind, [...(byKind.get(rule.kind) ?? []), rule]);
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Usage patterns" description="Layout, responsive, interaction, imagery, and content guidance." />
      <div className="ds-patterns">
        {[...byKind.entries()].map(([kind, kindRules]) => (
          <article className="ds-pattern" key={kind}>
            <span>{titleCase(kind)}</span>
            {kindRules.map((rule) => (
              <div key={rule.id}>
                <h4>{rule.name}</h4>
                <p className="ds-pattern__summary">{usagePatternSummary(rule.description)}</p>
                {usagePatternSummary(rule.description) !== rule.description.replace(/\s+/g, ' ').trim() ? (
                  <details className="ds-pattern__details">
                    <summary>View details</summary>
                    <p>{rule.description}</p>
                  </details>
                ) : null}
                <EvidenceLinks evidence={rule.evidence} />
                <ReviewFooter confidence={rule.confidence} reviewStatus={rule.reviewStatus} />
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
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

export function DesignSystemPanel({
  snapshot,
  status,
  generation,
  onRetryGeneration,
  appName,
  componentCrops = [],
  totalComponentOccurrences = 0,
  totalComponentTypes = 0,
}: DesignSystemPanelProps) {
  const [stage, setStage] = useState<'light' | 'dark'>('dark');
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

  const tokenGroups = (Object.keys(KIND_LABELS) as TokenKind[])
    .map((kind) => [kind, snapshot.tokens.filter((token) => token.kind === kind)] as const)
    .filter(([, tokens]) => tokens.length > 0);
  const hasComponents = snapshot.components.length > 0;
  const usageRules = (snapshot.rules ?? []).filter(isActionableUsageRule);
  const hasRules = usageRules.length > 0;
  const showcaseComponent = snapshot.components.find((component) => /market.*table|table.*card/i.test(component.name))
    ?? snapshot.components.find((component) => /stat.*card/i.test(component.name))
    ?? snapshot.components.find((component) => /nav/i.test(component.name))
    ?? snapshot.components[0];
  const showcaseVariant = showcaseComponent?.variants[0];

  if (!tokenGroups.length && !hasComponents && !hasRules) {
    if (cropOverview) return <div className="ds-page">{cropOverview}</div>;
    return <EmptyState title="No design system available" description="No design tokens, components, or rules are available for this app." headingLevel={2} />;
  }

  let sectionIndex = 0;
  const screenshot = snapshot.provenance?.screenshotUrl ?? snapshot.provenance?.thumbnailUrl;
  const isRefero = snapshot.provenance?.provider === 'refero';
  return (
    <div className="ds-page">
      <style>{DESIGN_SYSTEM_REFERENCE_STYLES}</style>
      {generation ? <GenerationBanner generation={generation} onRetry={onRetryGeneration} /> : null}
      <header className="ds-page__header">
        <div>
          <span className="ds-page__eyebrow">{isRefero ? 'Imported style reference' : 'Design system analysis'}</span>
          <h2>{titleCase(snapshot.app)}</h2>
          <p>{snapshot.summary ?? 'A living styleguide reconstructed from the available product evidence.'}</p>
          <div className="ds-refero-source">
            <span>{isRefero ? 'Refero source · External import' : 'Vitrines · Observed evidence'}</span>
            {snapshot.provenance?.originalUrl ? <a href={snapshot.provenance.originalUrl} target="_blank" rel="noreferrer">Original website</a> : null}
            {snapshot.provenance?.sourceUrl ? <a href={snapshot.provenance.sourceUrl} target="_blank" rel="noreferrer">Source reference</a> : null}
          </div>
        </div>
        <div className="ds-page__stats">
          <span><strong>{snapshot.tokens.length}</strong> tokens</span>
          <span><strong>{snapshot.components.length}</strong> components</span>
          <span><strong>{usageRules.length}</strong> patterns</span>
        </div>
      </header>

      <div className="ds-refero-layout">
        <div className="ds-refero-reference">
          {screenshot ? <figure className="ds-refero-hero"><img src={screenshot} alt={`${titleCase(snapshot.app)} source website`} /></figure> : null}
          {cropOverview}
          <div className="ds-toolbar">
            <span className="ds-page__eyebrow">Style preview</span>
            <SegmentedControl className="ds-toggle" value={stage} onChange={(value) => setStage(value as 'light' | 'dark')} label="Preview theme">
              <SegmentedControlItem value="light" label="Light" />
              <SegmentedControlItem value="dark" label="Dark" />
            </SegmentedControl>
          </div>
          <div className={`ds-canvas ds-canvas--${stage}`} data-theme={stage}>
          <header className="ds-canvas__intro">
            <div className="ds-canvas__intro-copy">
              <span>Living styleguide</span>
              <h3>{titleCase(snapshot.app)} foundations &amp; components</h3>
              <p>Visual specimens reconstructed from the design tokens, component definitions, and product rules available in Vitrines.</p>
            </div>
            {showcaseComponent && showcaseVariant ? (
              <div className="ds-canvas__showcase"><ComponentSample componentName={showcaseComponent.name} variant={showcaseVariant} /></div>
            ) : null}
          </header>

          {tokenGroups.map(([kind, tokens]) => {
            sectionIndex += 1;
            if (kind === 'color') return <ColorSection key={kind} index={sectionIndex} tokens={tokens} />;
            if (kind === 'typography') return <TypographySection key={kind} index={sectionIndex} tokens={tokens} />;
            return <FoundationSection key={kind} index={sectionIndex} kind={kind} tokens={tokens} />;
          })}
          {hasComponents ? <ComponentsSection index={(sectionIndex += 1)} components={snapshot.components} /> : null}
          {hasRules ? <PatternsSection index={(sectionIndex += 1)} rules={usageRules} /> : null}
          </div>
        </div>
        <DesignSystemReferencePane snapshot={snapshot} markdown={designSystemMarkdown(snapshot)} />
      </div>
    </div>
  );
}
