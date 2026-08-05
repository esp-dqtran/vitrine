import { EmptyState, Text } from '@astryxdesign/core';
import type { DesignSystemSnapshot, TokenKind } from '../../designSystem.ts';
import { isActionableUsageRule } from '../../usagePatterns.ts';
import { createSiteDesignSystem } from '../../siteDesignSystem.ts';
import { DESIGN_SYSTEM_REFERENCE_STYLES } from '../designSystemReferenceStyles.ts';
import type { SiteVersionDetail } from '../types.ts';
import { DesignSystemReferencePane } from './DesignSystemReferencePane.tsx';
import {
  ColorSection,
  ComponentSample,
  ComponentsSection,
  DesignSystemHeader,
  FoundationSection,
  PatternsSection,
  pickShowcaseComponent,
  ThemeCanvas,
  TypographySection,
} from './DesignSystemShowcase.tsx';

function renderSiteEvidence(evidence: string[]) {
  if (!evidence.length) return null;
  return <Text as="div" type="supporting" color="secondary">{evidence.length} source element{evidence.length === 1 ? '' : 's'}</Text>;
}

const TOKEN_KINDS: TokenKind[] = ['color', 'typography', 'spacing', 'radius', 'border', 'effect'];

function markdown(snapshot: DesignSystemSnapshot<string>): string {
  const lines = [`# ${snapshot.app} — Design System`, ''];
  if (snapshot.provenance?.northStar) lines.push(`> ${snapshot.provenance.northStar}`, '');
  if (snapshot.summary) lines.push(snapshot.summary, '');
  for (const kind of TOKEN_KINDS) {
    const tokens = snapshot.tokens.filter((token) => token.kind === kind);
    if (!tokens.length) continue;
    lines.push(`## ${kind[0]!.toUpperCase()}${kind.slice(1)}`, '');
    for (const token of tokens) lines.push(`- **${token.name}**: \`${token.value}\` — ${token.role}`);
    lines.push('');
  }
  if (snapshot.components.length) {
    lines.push('## Components', '');
    for (const component of snapshot.components) {
      lines.push(`### ${component.name}`, '', component.description);
      for (const variant of component.variants) lines.push(`- **${variant.name}**: ${variant.description}`);
      lines.push('');
    }
  }
  if (snapshot.rules?.length) {
    lines.push('## Usage rules', '');
    for (const rule of snapshot.rules) lines.push(`- **${rule.name}**: ${rule.description}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

export function SiteDesignSystemPanel({ detail }: { detail: SiteVersionDetail }) {
  const stored = siteDesignSystemForDetail(detail);
  if (!stored) {
    return (
      <div className="ds-page">
        <EmptyState
          title="Design system not extracted"
          description="Re-import this public page to analyze its rendered styles and components."
          isCompact
        />
      </div>
    );
  }
  const screenshotUrl = detail.pages[0]?.fullPageImageUrl;
  const snapshot: DesignSystemSnapshot<string> = {
    ...stored,
    provenance: {
      ...stored.provenance,
      provider: 'vitrines',
      ...(screenshotUrl ? { screenshotUrl } : {}),
    },
  };
  const tokenGroups = TOKEN_KINDS
    .map((kind) => [kind, snapshot.tokens.filter((token) => token.kind === kind)] as const)
    .filter(([, tokens]) => tokens.length > 0);
  const hasComponents = snapshot.components.length > 0;
  const usageRules = (snapshot.rules ?? []).filter(isActionableUsageRule);
  const hasRules = usageRules.length > 0;
  const showcase = pickShowcaseComponent(snapshot.components);

  let sectionIndex = 0;
  return (
    <section className="site-design-system" aria-labelledby="site-design-system-title">
      <style>{DESIGN_SYSTEM_REFERENCE_STYLES}</style>
      <DesignSystemHeader
        eyebrow="Design system analysis"
        title={`${snapshot.app} design system`}
        summary={snapshot.summary ?? "Extracted from the rendered page's computed CSS."}
        sourceLabel="Vitrines · Observed evidence"
        originalUrl={snapshot.provenance?.originalUrl}
        sourceUrl={snapshot.provenance?.sourceUrl}
        tokenCount={snapshot.tokens.length}
        componentCount={snapshot.components.length}
        patternCount={usageRules.length}
      />
      <div className="ds-refero-layout">
        <div className="ds-refero-reference">
          {screenshotUrl ? (
            <figure className="ds-refero-hero">
              <img src={screenshotUrl} alt={`${detail.site.name} rendered page`} />
            </figure>
          ) : null}
          <ThemeCanvas
            title={`${snapshot.app} foundations & components`}
            description="Color, typography, spacing, and component patterns read directly from the rendered page's computed CSS."
            showcase={showcase
              ? <ComponentSample componentName={showcase.component.name} variant={showcase.variant} />
              : undefined}
          >
            {tokenGroups.map(([kind, tokens]) => {
              sectionIndex += 1;
              if (kind === 'color') return <ColorSection key={kind} index={sectionIndex} tokens={tokens} renderEvidence={renderSiteEvidence} />;
              if (kind === 'typography') return <TypographySection key={kind} index={sectionIndex} tokens={tokens} renderEvidence={renderSiteEvidence} />;
              return <FoundationSection key={kind} index={sectionIndex} kind={kind} tokens={tokens} renderEvidence={renderSiteEvidence} />;
            })}
            {hasComponents ? <ComponentsSection index={(sectionIndex += 1)} components={snapshot.components} renderEvidence={renderSiteEvidence} /> : null}
            {hasRules ? <PatternsSection index={(sectionIndex += 1)} rules={usageRules} renderEvidence={renderSiteEvidence} /> : null}
          </ThemeCanvas>
        </div>
        <DesignSystemReferencePane snapshot={snapshot} markdown={markdown(snapshot)} />
      </div>
    </section>
  );
}

export function siteDesignSystemForDetail(
  detail: SiteVersionDetail,
): DesignSystemSnapshot<string> | undefined {
  if (!detail.analysis) return undefined;
  if (detail.analysis.designSystem) return detail.analysis.designSystem;
  const generatedAt = detail.versionOptions
    .find((version) => version.id === detail.version.id)?.updatedAt;
  return createSiteDesignSystem({
    app: detail.site.name,
    sourceUrl: detail.canonicalUrl,
    analysis: detail.analysis,
    ...(generatedAt ? { generatedAt } : { generatedAt: '1970-01-01T00:00:00.000Z' }),
  });
}
