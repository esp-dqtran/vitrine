import { EmptyState, Text } from '@astryxdesign/core';
import type { DesignSystemSnapshot, TokenKind } from '../../designSystem.ts';
import { createSiteDesignSystem } from '../../siteDesignSystem.ts';
import { DESIGN_SYSTEM_REFERENCE_STYLES } from '../designSystemReferenceStyles.ts';
import type { SiteVersionDetail } from '../types.ts';
import { DesignSystemReferencePane } from './DesignSystemReferencePane.tsx';
import { ColorSection, FoundationSection, ThemeCanvas, TypographySection } from './DesignSystemShowcase.tsx';

function renderSiteEvidence(evidence: string[]) {
  if (!evidence.length) return null;
  return <Text as="div" type="supporting" color="secondary">{evidence.length} source element{evidence.length === 1 ? '' : 's'}</Text>;
}

const SITE_DESIGN_SYSTEM_STYLES = String.raw`
.site-design-system {
  padding-top: 32px;
}
.site-design-system__profile {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.site-design-system__summary,
.site-design-system__section {
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-bg-secondary);
  padding: 22px;
}
.site-design-system__summary h2,
.site-design-system__section h3 {
  margin: 0;
}
.site-design-system__summary p {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.site-design-system__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.site-design-system__meta span {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.site-design-system__section {
  display: grid;
  gap: 16px;
}
.site-design-system__section header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
.site-design-system__section header span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.site-design-system__components,
.site-design-system__rules {
  display: grid;
  gap: 12px;
}
.site-design-system__component,
.site-design-system__rule {
  padding: 14px 0;
  border-top: 1px solid var(--color-border);
}
.site-design-system__component:first-child,
.site-design-system__rule:first-child {
  border-top: 0;
  padding-top: 0;
}
.site-design-system__component > div,
.site-design-system__rule > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.site-design-system__component p,
.site-design-system__rule p {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.site-design-system__component span,
.site-design-system__rule span {
  color: var(--color-text-secondary);
  font-size: 11px;
  white-space: nowrap;
}
`;

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
      <section className="site-design-system">
        <EmptyState
          title="Design system not extracted"
          description="Re-import this public page to analyze its rendered styles and components."
          isCompact
        />
      </section>
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
  const grouped = TOKEN_KINDS.map((kind) => [
    kind,
    snapshot.tokens.filter((token) => token.kind === kind),
  ] as const).filter(([, tokens]) => tokens.length);

  return (
    <section className="site-design-system" aria-labelledby="site-design-system-title">
      <style>{DESIGN_SYSTEM_REFERENCE_STYLES + SITE_DESIGN_SYSTEM_STYLES}</style>
      <div className="ds-refero-layout">
        <div className="site-design-system__profile">
          {screenshotUrl ? (
            <div className="ds-refero-hero">
              <img src={screenshotUrl} alt={`${detail.site.name} rendered page`} />
            </div>
          ) : null}
          <section className="site-design-system__summary">
            <h2 id="site-design-system-title">{snapshot.app} design system</h2>
            <p>{snapshot.summary}</p>
            <div className="site-design-system__meta">
              <span>{snapshot.provenance?.theme ?? 'Rendered'} theme</span>
              <span>{snapshot.tokens.length} tokens</span>
              <span>{snapshot.components.length} components</span>
              <span>Captured evidence</span>
            </div>
          </section>
          {grouped.length ? (
            <ThemeCanvas
              title={`${snapshot.app} foundations`}
              description="Color, typography, and spacing tokens read directly from the rendered page's computed CSS."
            >
              {grouped.map(([kind, tokens], index) => {
                if (kind === 'color') return <ColorSection key={kind} index={index + 1} tokens={tokens} renderEvidence={renderSiteEvidence} />;
                if (kind === 'typography') return <TypographySection key={kind} index={index + 1} tokens={tokens} renderEvidence={renderSiteEvidence} />;
                return <FoundationSection key={kind} index={index + 1} kind={kind} tokens={tokens} renderEvidence={renderSiteEvidence} />;
              })}
            </ThemeCanvas>
          ) : null}
          <section className="site-design-system__section">
            <header><h3>Components</h3><span>{snapshot.components.length} families</span></header>
            <div className="site-design-system__components">
              {snapshot.components.map((component) => (
                <article className="site-design-system__component" key={component.id}>
                  <div><strong>{component.name}</strong><span>{component.variants.length} variants</span></div>
                  <p>{component.description}</p>
                </article>
              ))}
            </div>
          </section>
          {snapshot.rules?.length ? (
            <section className="site-design-system__section">
              <header><h3>Usage rules</h3><span>{snapshot.rules.length} observed rules</span></header>
              <div className="site-design-system__rules">
                {snapshot.rules.map((rule) => (
                  <article className="site-design-system__rule" key={rule.id}>
                    <div><strong>{rule.name}</strong><span>{rule.kind}</span></div>
                    <p>{rule.description}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
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
