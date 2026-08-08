import { EmptyState, SegmentedControl, SegmentedControlItem, Text } from '@astryxdesign/core';
import { useEffect, useRef, useState } from 'react';
import type { DesignSystemSnapshot, DesignToken, TokenKind } from '../../designSystem.ts';
import { isActionableUsageRule } from '../../usagePatterns.ts';
import { createSiteDesignSystem } from '../../siteDesignSystem.ts';
import { DESIGN_SYSTEM_REFERENCE_STYLES } from '../designSystemReferenceStyles.ts';
import type { SiteVersionDetail } from '../types.ts';
import { DesignSystemReferencePane, type DesignSystemReferenceSection } from './DesignSystemReferencePane.tsx';
import { useSegmentedIndicator } from './useSegmentedIndicator.ts';
import {
  ColorSection,
  LayoutTokensSection,
  PatternsSection,
  TypographySection,
  pxValue,
} from './DesignSystemShowcase.tsx';

function renderSiteEvidence(evidence: string[]) {
  if (!evidence.length) return null;
  return <Text as="div" type="supporting" color="secondary">{evidence.length} source element{evidence.length === 1 ? '' : 's'}</Text>;
}

// These are the foundations a designer can act on in this reference. Effects and
// inferred component patterns remain in the underlying analysis, but are not
// presented as part of the site's reusable design-system handoff.
const REFERENCE_TOKEN_KINDS: TokenKind[] = ['color', 'typography', 'spacing', 'radius', 'border'];

const DESIGNER_TOKEN_LIMITS: Partial<Record<TokenKind, number>> = {
  color: 8,
  typography: 6,
  spacing: 6,
  radius: 4,
  border: 3,
};

const SPACING_STEPS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RADIUS_STEPS = [2, 4, 6, 8, 10, 12, 16, 24];

function humanize(value: string): string {
  return value
    .replace(/^--/, '')
    .split(/--|[-_]+/)
    .filter(Boolean)
    .map((part) => part.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(' / ');
}

function isTransparentColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/i.test(value)
    || /^rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value)
    || value.toLowerCase() === 'transparent';
}

function isBorderColor(token: DesignToken<string>): boolean {
  return token.kind === 'color' && /(?:^|[-_\s/])(border|stroke|divider|outline)(?:[-_\s/]|$)/i.test(token.name);
}

function typographyPart(value: string, property: string, index: number): string | undefined {
  const propertyMatch = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(value)?.[1]?.trim();
  return propertyMatch || value.split('/').map((part) => part.trim())[index];
}

function typographySize(value: string): number {
  return Number.parseFloat(typographyPart(value, 'font-size', 1) ?? '') || 0;
}

function typographyWeight(value: string): number {
  return Number.parseFloat(typographyPart(value, 'font-weight', 2) ?? '') || 0;
}

function typographyLabel(token: DesignToken<string>): string {
  const size = typographySize(token.value);
  const weight = typographyWeight(token.value);
  if (size >= 64) return 'Display';
  if (size >= 24) return weight >= 600 ? 'Heading / Bold' : 'Heading';
  if (size >= 18) return 'Body / Large';
  if (size >= 14) return 'Body';
  return 'Caption';
}

function designerLabel(token: DesignToken<string>): string {
  if (token.kind === 'color') return token.name.startsWith('--') ? humanize(token.name) : token.name.replace(/ color(?: \d+)?$/i, '');
  if (token.kind === 'typography') return typographyLabel(token);
  return `${humanize(token.kind)} ${token.value}`;
}

function nearestStep(value: number, steps: number[]): number {
  return steps.reduce((closest, step) => Math.abs(step - value) < Math.abs(closest - value) ? step : closest, steps[0]!);
}

function visibleBorder(token: DesignToken<string>): boolean {
  const width = pxValue(token.value);
  return Boolean(width && width > 0 && !/\bnone\b/i.test(token.value));
}

function curatedFoundationToken(token: DesignToken<string>): DesignToken<string> {
  const amount = pxValue(token.value);
  if (token.kind === 'spacing' && amount != null) {
    const value = nearestStep(amount, SPACING_STEPS);
    return { ...token, name: `Space ${value}`, value: `${value}px`, role: 'Curated layout spacing' };
  }
  if (token.kind === 'radius' && amount != null) {
    const value = nearestStep(amount, RADIUS_STEPS);
    const name = value <= 2 ? 'Tight' : value <= 6 ? 'Control' : value <= 12 ? 'Surface' : 'Large surface';
    return { ...token, name, value: `${value}px`, role: 'Curated corner radius' };
  }
  return { ...token, name: token.name.replace(/(?:\s+)?border$/i, '') || 'Stroke', role: 'Visible border treatment' };
}

export function curateTokens(tokens: DesignToken<string>[], kind: TokenKind): DesignToken<string>[] {
  const seen = new Set<string>();
  const limit = DESIGNER_TOKEN_LIMITS[kind] ?? tokens.length;
  return tokens
    .filter((token) => {
      if (kind === 'color') return !isTransparentColor(token.value) && !isBorderColor(token);
      const amount = pxValue(token.value);
      if (kind === 'spacing') return amount != null && amount >= 4;
      if (kind === 'radius') return amount != null && amount >= 2;
      if (kind === 'border') return visibleBorder(token);
      return true;
    })
    .map((token) => (kind === 'spacing' || kind === 'radius' || kind === 'border' ? curatedFoundationToken(token) : token))
    .sort((left, right) => {
      if (kind === 'typography') {
        return typographySize(right.value) - typographySize(left.value)
          || typographyWeight(right.value) - typographyWeight(left.value)
          || right.evidence.length - left.evidence.length;
      }
      if (kind === 'spacing' || kind === 'radius') {
        return (pxValue(left.value) ?? 0) - (pxValue(right.value) ?? 0);
      }
      const namedTokenOrder = Number(right.name.startsWith('--')) - Number(left.name.startsWith('--'));
      return namedTokenOrder || right.evidence.length - left.evidence.length;
    })
    .filter((token) => {
      const key = kind === 'typography'
        ? typographyLabel(token)
        : token.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((token) => ({
      ...token,
      name: kind === 'spacing' || kind === 'radius' || kind === 'border' ? token.name : designerLabel(token),
      role: kind === 'color' ? 'Observed color token' : token.role,
    }));
}

function markdown(snapshot: DesignSystemSnapshot<string>, includeUsageRules = false): string {
  const lines = [`# ${snapshot.app} — Design System`, ''];
  if (snapshot.provenance?.northStar) lines.push(`> ${snapshot.provenance.northStar}`, '');
  const summary = referenceSummary(snapshot.summary);
  if (summary) lines.push(summary, '');
  for (const kind of REFERENCE_TOKEN_KINDS) {
    const tokens = snapshot.tokens.filter((token) => token.kind === kind);
    if (!tokens.length) continue;
    lines.push(`## ${kind[0]!.toUpperCase()}${kind.slice(1)}`, '');
    for (const token of tokens) lines.push(`- **${token.name}**: \`${token.value}\` — ${token.role}`);
    lines.push('');
  }
  if (includeUsageRules && snapshot.rules?.length) {
    lines.push('## Usage rules', '');
    for (const rule of snapshot.rules) lines.push(`- **${rule.name}**: ${rule.description}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function referenceSummary(summary: string | undefined): string | undefined {
  return summary
    ?.replace(/\s*(?:and|,)\s*\d+\s+component famil(?:y|ies)\.?/i, '.')
    .replace(/\.\s*\./g, '.')
    .trim();
}

export function SiteDesignSystemPanel({
  detail,
  isAdmin = false,
}: {
  detail: SiteVersionDetail;
  isAdmin?: boolean;
}) {
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
  const previewVideoUrl = detail.version.previewMediaKind === 'video'
    ? detail.version.previewUrl
    : undefined;
  const snapshot: DesignSystemSnapshot<string> = {
    ...stored,
    provenance: {
      ...stored.provenance,
      provider: 'vitrines',
      ...(screenshotUrl ? { screenshotUrl } : {}),
    },
  };
  const tokenGroups = REFERENCE_TOKEN_KINDS
    .map((kind) => [kind, curateTokens(snapshot.tokens.filter((token) => token.kind === kind), kind)] as const)
    .filter(([, tokens]) => tokens.length > 0);
  const primaryTokenGroups = tokenGroups.filter(([kind]) => kind === 'color' || kind === 'typography');
  const spacingFoundationTokenGroups = tokenGroups.filter(([kind]) => kind === 'spacing' || kind === 'radius' || kind === 'border');
  const usageRules = (snapshot.rules ?? []).filter(isActionableUsageRule);
  const hasRules = usageRules.length > 0;
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeReferenceSection, setActiveReferenceSection] = useState<DesignSystemReferenceSection>('overview');
  const [visualTheme, setVisualTheme] = useState<'light' | 'dark'>('dark');
  const visualThemeRef = useSegmentedIndicator(visualTheme);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top));
      const section = visible[0]?.target.getAttribute('data-design-system-section') as DesignSystemReferenceSection | null;
      if (section) setActiveReferenceSection(section);
    }, { root: null, rootMargin: '-18% 0px -60% 0px', threshold: 0 });
    root.querySelectorAll<HTMLElement>('[data-design-system-section]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [hasRules, primaryTokenGroups.length, spacingFoundationTokenGroups.length]);

  let sectionIndex = 0;
  return (
    <section className="site-design-system" aria-label="Design system">
      <style>{DESIGN_SYSTEM_REFERENCE_STYLES}</style>
      {previewVideoUrl || screenshotUrl ? (
        <figure className="ds-refero-hero">
          {previewVideoUrl ? (
            <video
              data-site-design-system-preview-video="true"
              src={previewVideoUrl}
              poster={detail.version.posterUrl ?? screenshotUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
            />
          ) : (
            <img src={screenshotUrl} alt={`${detail.site.name} rendered page`} />
          )}
        </figure>
      ) : null}
      <div className="ds-refero-layout">
        <div className="ds-refero-reference">
          <div className={`ds-canvas ds-canvas--${visualTheme}`} data-theme={visualTheme} ref={contentRef}>
            <div className="ds-canvas__theme-control">
              <SegmentedControl ref={visualThemeRef} className="ds-toggle" value={visualTheme} onChange={(value) => setVisualTheme(value as 'light' | 'dark')} label="Preview theme">
                <SegmentedControlItem value="light" label="Light" />
                <SegmentedControlItem value="dark" label="Dark" />
              </SegmentedControl>
            </div>
            {primaryTokenGroups.map(([kind, tokens]) => {
              sectionIndex += 1;
              if (kind === 'color') return <div key={kind} data-design-system-section="color"><ColorSection index={sectionIndex} tokens={tokens} /></div>;
              return <div key={kind} data-design-system-section="typography"><TypographySection index={sectionIndex} tokens={tokens} /></div>;
            })}
            {spacingFoundationTokenGroups.length ? (
              <div className="ds-foundations-panel__content" data-design-system-section="spacing">
                <LayoutTokensSection
                  index={(sectionIndex += 1)}
                  spacing={spacingFoundationTokenGroups.find(([kind]) => kind === 'spacing')?.[1] ?? []}
                  radius={spacingFoundationTokenGroups.find(([kind]) => kind === 'radius')?.[1] ?? []}
                  border={spacingFoundationTokenGroups.find(([kind]) => kind === 'border')?.[1] ?? []}
                />
              </div>
            ) : null}
            {isAdmin && hasRules ? <div data-design-system-section="usage-rules"><PatternsSection index={(sectionIndex += 1)} rules={usageRules} renderEvidence={renderSiteEvidence} /></div> : null}
            {isAdmin ? (
              <details className="ds-raw-evidence">
                <summary>Raw extraction evidence <span>{snapshot.tokens.length} detected values</span></summary>
                <div className="ds-raw-evidence__list">
                  {snapshot.tokens.map((token) => (
                    <div key={token.id}>
                      <strong>{token.name}</strong>
                      <code>{token.value}</code>
                      <span>{token.reviewStatus === 'needs_review' ? 'Needs review' : token.reviewStatus ?? 'Observed'} · {Math.round((token.confidence ?? 0) * 100)}% confidence</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
        <DesignSystemReferencePane
          snapshot={snapshot}
          markdown={markdown(snapshot, isAdmin)}
          tokenKinds={REFERENCE_TOKEN_KINDS}
          summary={referenceSummary(snapshot.summary)}
          activeSection={activeReferenceSection}
        />
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
