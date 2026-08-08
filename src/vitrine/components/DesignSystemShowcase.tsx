import { useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, Button, SegmentedControl, SegmentedControlItem, Text, TextInput } from '@astryxdesign/core';
import type { ComponentVariant, DesignComponent, DesignToken, ReviewStatus, TokenKind } from '../../designSystem.ts';
import { usagePatternSummary } from '../../usagePatterns.ts';
import { useSegmentedIndicator } from './useSegmentedIndicator.ts';

export const KIND_LABELS: Record<TokenKind, string> = {
  color: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radii',
  border: 'Borders',
  effect: 'Effects',
};

export const SECTION_LABELS: Record<TokenKind, string> = {
  color: 'Color palette',
  typography: 'Typography scale',
  spacing: 'Spacing rhythm',
  radius: 'Corner radii',
  border: 'Border styles',
  effect: 'Visual effects',
};

const REVIEW_VARIANT: Record<ReviewStatus, 'success' | 'warning' | 'error'> = {
  reviewed: 'success',
  needs_review: 'warning',
  rejected: 'error',
};

export const titleCase = (value: string) => value
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const pxValue = (value: string): number | undefined => {
  const match = /(-?\d+(?:\.\d+)?)\s*px/.exec(value);
  return match ? Number(match[1]) : undefined;
};

export const typographyProperty = (value: string, property: string): string | undefined => {
  const match = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(value);
  return match?.[1]?.trim();
};

export const safeColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return /^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[a-z]+$|var\()/i.test(value.trim()) ? value.trim() : fallback;
};

function colorChannels(value: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? hex.split('').map((part) => `${part}${part}`).join('') : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value.trim());
  if (!rgb) return undefined;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

export function swatchTextColor(value: string): '#101114' | '#fff' {
  const channels = colorChannels(value);
  if (!channels) return '#fff';
  const luminance = channels
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.179 ? '#101114' : '#fff';
}

export function ReviewFooter({
  confidence,
  reviewStatus,
  showReviewMetadata = false,
}: {
  confidence?: number;
  reviewStatus?: ReviewStatus;
  showReviewMetadata?: boolean;
}) {
  if (!showReviewMetadata || (confidence == null && !reviewStatus)) return null;
  return (
    <div className="ds-review">
      {reviewStatus ? <Badge variant={REVIEW_VARIANT[reviewStatus]} label={reviewStatus === 'reviewed' ? 'Reviewed' : reviewStatus === 'rejected' ? 'Rejected' : 'Needs review'} /> : null}
      {confidence != null ? <Text type="supporting" color="secondary">{Math.round(confidence * 100)}% confidence</Text> : null}
    </div>
  );
}

export function SectionHeading({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <header className="ds-section__heading">
      <span>{String(index).padStart(2, '0')}</span>
      <div>
        <div className="ds-section__title" role="heading" aria-level={3}>{title}</div>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function TokenMeta<E>({
  token,
  renderEvidence,
  showReviewMetadata,
}: {
  token: DesignToken<E>;
  renderEvidence: (evidence: E[]) => ReactNode;
  showReviewMetadata?: boolean;
}) {
  return (
    <div className="ds-token__meta">
      <div className="ds-token__name">{token.name}</div>
      <code>{token.value}</code>
      <p>{token.role}</p>
      {renderEvidence(token.evidence)}
      <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} showReviewMetadata={showReviewMetadata} />
    </div>
  );
}

export function ColorSection<E>({ index, tokens }: {
  index: number;
  tokens: DesignToken<E>[];
}) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Color palette" description="Core colors and the roles they play across the product." />
      <div className="ds-colors">
        {tokens.map((token) => (
          <article className="ds-color" key={token.id}>
            <div
              className="ds-color__swatch"
              style={{ background: safeColor(token.value, 'var(--ds-muted)'), color: swatchTextColor(token.value) }}
              aria-label={`${token.name}: ${token.value}`}
            >
              <span className="ds-color__name">{token.name}</span>
              <code className="ds-color__hex">{token.value}</code>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function roundedTypeValue(value: string | undefined): string | undefined {
  const numeric = Number.parseFloat(value ?? '');
  if (!Number.isFinite(numeric)) return undefined;
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
}

function typeWeightLabel(weight: string | undefined): string | undefined {
  const numeric = Number.parseFloat(weight ?? '');
  if (!Number.isFinite(numeric)) return undefined;
  const names: Record<number, string> = {
    100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
    600: 'Semibold', 700: 'Bold', 800: 'Extrabold', 900: 'Black',
  };
  return `${names[numeric] ?? 'Weight'} · ${numeric}`;
}

function typeFamilyLabel(family: string | undefined): string | undefined {
  return family?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || undefined;
}

export function TypographySection<E>({ index, tokens, showReviewMetadata }: {
  index: number;
  tokens: DesignToken<E>[];
  showReviewMetadata?: boolean;
}) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Typography scale" description="Type roles shown at their extracted size, weight, and rhythm." />
      <div className="ds-type-list">
        {tokens.map((token) => {
          const parts = token.value.split('/').map((part) => part.trim());
          const propertyOrPart = (property: string, index: number) => typographyProperty(token.value, property) ?? parts[index];
          const rawSize = propertyOrPart('font-size', 1);
          const size = Math.min(Number.parseFloat(rawSize ?? '') || pxValue(token.value) || 18, 96);
          const weight = propertyOrPart('font-weight', 2);
          const lineHeight = propertyOrPart('line-height', 3);
          const family = propertyOrPart('font-family', 0);
          const letterSpacing = propertyOrPart('letter-spacing', 4);
          const sizeLabel = roundedTypeValue(rawSize);
          const lineHeightLabel = roundedTypeValue(lineHeight);
          const weightLabel = typeWeightLabel(weight);
          const familyLabel = typeFamilyLabel(family);
          return (
            <article className="ds-type" key={token.id}>
              <div
                className="ds-type__sample"
                style={{ fontSize: `min(${size}px, 16cqw)`, fontWeight: weight, lineHeight, fontFamily: family, letterSpacing: letterSpacing === 'normal' ? undefined : letterSpacing }}
              >
                {token.name}
              </div>
              <div className="ds-type__meta">
                {sizeLabel ? <div className="ds-type__measure">{sizeLabel}{lineHeightLabel ? ` / ${lineHeightLabel}` : null}</div> : null}
                {weightLabel ? <div className="ds-type__weight">{weightLabel}</div> : null}
                {familyLabel ? <div className="ds-type__family">{familyLabel}</div> : null}
                {token.evidence.length ? <div className="ds-type__evidence">Observed in {token.evidence.length} element{token.evidence.length === 1 ? '' : 's'}</div> : null}
                <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} showReviewMetadata={showReviewMetadata} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function FoundationSample({ token }: { token: DesignToken<unknown> }) {
  const amount = Math.max(2, Math.min(pxValue(token.value) ?? 16, 144));
  if (token.kind === 'spacing') return <div className="ds-foundation__spacing" style={{ width: amount }} />;
  if (token.kind === 'radius') return <div className="ds-foundation__shape" style={{ borderRadius: amount }} />;
  if (token.kind === 'border') return <div className="ds-foundation__shape" style={{ borderWidth: Math.min(amount, 8) }} />;
  const effectType = /box shadow/i.test(token.role)
    ? 'shadow'
    : /filter/i.test(token.role)
      ? 'filter'
      : /transform/i.test(token.role)
        ? 'transform'
        : 'effect';
  return (
    <div
      className={`ds-foundation__effect ds-foundation__effect--${effectType}`}
      data-effect-type={effectType}
      {...(effectType === 'shadow' ? { style: { boxShadow: token.value } } : {})}
    >
      {effectType === 'shadow' ? null : <span>{effectType}</span>}
    </div>
  );
}

type LayoutTokenKind = Extract<TokenKind, 'spacing' | 'radius' | 'border'>;

const LAYOUT_TOKEN_COPY: Record<LayoutTokenKind, { title: string; description: string }> = {
  spacing: { title: 'Spacing scale', description: 'Steps used to create rhythm in layouts and controls.' },
  radius: { title: 'Corner radii', description: 'Corner treatments for controls and surfaces.' },
  border: { title: 'Visible borders', description: 'Strokes that are visibly present in the rendered interface.' },
};

function borderDetails(value: string): { width: string; style: string; color: string } {
  const match = /^(\S+)\s+(\S+)\s+(.+)$/.exec(value.trim());
  return match
    ? { width: match[1], style: match[2], color: match[3] }
    : { width: value, style: '', color: '' };
}

function LayoutTokenPreview({ token }: { token: DesignToken<unknown> }) {
  const amount = pxValue(token.value) ?? 8;
  if (token.kind === 'spacing') {
    return (
      <div className="ds-layout-token__spacing-preview" aria-hidden="true">
        <span style={{ width: Math.max(24, Math.min(amount * 3, 144)) }} />
      </div>
    );
  }
  if (token.kind === 'radius') {
    return <div className="ds-layout-token__radius-preview" style={{ borderRadius: amount }} aria-hidden="true" />;
  }
  const border = borderDetails(token.value);
  return (
    <div className="ds-layout-token__border-preview" aria-hidden="true">
      <span style={{ borderWidth: border.width, borderStyle: border.style, borderColor: safeColor(border.color, 'var(--ds-text)') }} />
    </div>
  );
}

export function LayoutTokensSection<E>({
  index,
  spacing,
  radius,
  border,
  showReviewMetadata,
}: {
  index: number;
  spacing: DesignToken<E>[];
  radius: DesignToken<E>[];
  border: DesignToken<E>[];
  showReviewMetadata?: boolean;
}) {
  const groups: Array<[LayoutTokenKind, DesignToken<E>[]]> = [
    ['spacing', spacing],
    ['radius', radius],
    ['border', border],
  ].filter(([, tokens]) => tokens.length > 0) as Array<[LayoutTokenKind, DesignToken<E>[]]>;
  if (!groups.length) return null;

  return (
    <section className="ds-section ds-layout-tokens">
      <SectionHeading index={index} title="Spacing & Borders" description="The layout tokens that create the interface’s rhythm, shape, and definition." />
      <div className="ds-layout-tokens__groups">
        {groups.map(([kind, tokens]) => (
          <section className="ds-layout-token-group" key={kind} aria-label={LAYOUT_TOKEN_COPY[kind].title}>
            <header>
              <h4>{LAYOUT_TOKEN_COPY[kind].title}</h4>
              <p>{LAYOUT_TOKEN_COPY[kind].description}</p>
            </header>
            <div className="ds-layout-token-group__grid">
              {tokens.map((token) => {
                const border = kind === 'border' ? borderDetails(token.value) : undefined;
                return (
                  <article className={`ds-layout-token ds-layout-token--${kind}`} key={token.id}>
                    <LayoutTokenPreview token={token} />
                    <div className="ds-layout-token__meta">
                      <span>{token.name}</span>
                      {border ? (
                        <>
                          <strong>{[border.width, border.style].filter(Boolean).join(' ')}</strong>
                          {border.color ? <code>{border.color}</code> : null}
                        </>
                      ) : <strong>{token.value}</strong>}
                      {token.evidence.length ? <small>Observed in {token.evidence.length} element{token.evidence.length === 1 ? '' : 's'}</small> : null}
                      <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} showReviewMetadata={showReviewMetadata} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function FoundationSection<E>({ index, kind, tokens, renderEvidence, showReviewMetadata }: {
  index: number;
  kind: TokenKind;
  tokens: DesignToken<E>[];
  renderEvidence: (evidence: E[]) => ReactNode;
  showReviewMetadata?: boolean;
}) {
  const descriptions: Partial<Record<TokenKind, string>> = {
    spacing: 'A consistent spacing rhythm for layout and controls.',
    radius: 'Corner treatments used to shape product surfaces.',
    border: 'Stroke treatments that separate and define surfaces.',
    effect: 'Shadows, filters, and transforms captured from the rendered page.',
  };
  return (
    <section className="ds-section">
      <SectionHeading index={index} title={SECTION_LABELS[kind]} description={descriptions[kind] ?? 'Extracted foundation tokens.'} />
      <div className="ds-foundations">
        {tokens.map((token) => (
          <article className="ds-foundation" key={token.id}>
            <div className="ds-foundation__preview"><FoundationSample token={token} /></div>
            <TokenMeta token={token} renderEvidence={renderEvidence} showReviewMetadata={showReviewMetadata} />
          </article>
        ))}
      </div>
    </section>
  );
}

function reconstructionStyle(spec: ComponentVariant<unknown>['reconstruction']): CSSProperties {
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

export function ComponentSample<E>({ componentName, variant, resolveCropUrl }: {
  componentName: string;
  variant: ComponentVariant<E>;
  resolveCropUrl?: (variant: ComponentVariant<E>) => string | undefined;
}) {
  const cropUrl = resolveCropUrl?.(variant);
  if (cropUrl) {
    return (
      <figure className="ds-specimen">
        <img src={cropUrl} alt={`${componentName} ${variant.name}`} />
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

export function ComponentsSection<E>({ index, components, renderEvidence, resolveCropUrl, showReviewMetadata }: {
  index: number;
  components: DesignComponent<E>[];
  renderEvidence: (evidence: E[]) => ReactNode;
  resolveCropUrl?: (variant: ComponentVariant<E>) => string | undefined;
  showReviewMetadata?: boolean;
}) {
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
                  <div className="ds-variant__stage"><ComponentSample componentName={component.name} variant={variant} resolveCropUrl={resolveCropUrl} /></div>
                  <div className="ds-variant__meta">
                    <strong>{variant.name}</strong>
                    <p>{variant.description}</p>
                    {renderEvidence(variant.evidence)}
                    <ReviewFooter confidence={variant.confidence} reviewStatus={variant.reviewStatus} showReviewMetadata={showReviewMetadata} />
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

export function PatternsSection<E>({ index, rules, renderEvidence, showReviewMetadata }: {
  index: number;
  rules: Array<{
    id: string;
    kind: string;
    name: string;
    description: string;
    evidence: E[];
    confidence?: number;
    reviewStatus?: ReviewStatus;
  }>;
  renderEvidence: (evidence: E[]) => ReactNode;
  showReviewMetadata?: boolean;
}) {
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
                {renderEvidence(rule.evidence)}
                <ReviewFooter confidence={rule.confidence} reviewStatus={rule.reviewStatus} showReviewMetadata={showReviewMetadata} />
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

export function pickShowcaseComponent<E>(components: DesignComponent<E>[]): {
  component: DesignComponent<E>;
  variant: ComponentVariant<E>;
} | undefined {
  const component = components.find((item) => /market.*table|table.*card/i.test(item.name))
    ?? components.find((item) => /stat.*card/i.test(item.name))
    ?? components.find((item) => /nav/i.test(item.name))
    ?? components[0];
  const variant = component?.variants[0];
  return component && variant ? { component, variant } : undefined;
}

export function DesignSystemHeader({
  eyebrow, title, summary, sourceLabel, originalUrl, sourceUrl, tokenCount, componentCount, patternCount,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sourceLabel: string;
  originalUrl?: string;
  sourceUrl?: string;
  tokenCount: number;
  componentCount: number;
  patternCount: number;
}) {
  return (
    <header className="ds-page__header">
      <div>
        <span className="ds-page__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{summary}</p>
        <div className="ds-refero-source">
          <span>{sourceLabel}</span>
          {originalUrl ? <a href={originalUrl} target="_blank" rel="noreferrer">Original website</a> : null}
          {sourceUrl && sourceUrl !== originalUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Source reference</a> : null}
        </div>
      </div>
      <div className="ds-page__stats">
        <span><strong>{tokenCount}</strong> tokens</span>
        <span><strong>{componentCount}</strong> components</span>
        <span><strong>{patternCount}</strong> patterns</span>
      </div>
    </header>
  );
}

export function ThemeCanvas({ title, description, showcase, children }: {
  title: string;
  description: string;
  showcase?: ReactNode;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<'light' | 'dark'>('dark');
  const stageRef = useSegmentedIndicator(stage);
  return (
    <>
      <div className="ds-toolbar">
        <span className="ds-page__eyebrow">Style preview</span>
        <SegmentedControl ref={stageRef} className="ds-toggle" value={stage} onChange={(value) => setStage(value as 'light' | 'dark')} label="Preview theme">
          <SegmentedControlItem value="light" label="Light" />
          <SegmentedControlItem value="dark" label="Dark" />
        </SegmentedControl>
      </div>
      <div className={`ds-canvas ds-canvas--${stage}`} data-theme={stage}>
        <header className="ds-canvas__intro">
          <div className="ds-canvas__intro-copy">
            <span>Living styleguide</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          {showcase ? <div className="ds-canvas__showcase">{showcase}</div> : null}
        </header>
        {children}
      </div>
    </>
  );
}
