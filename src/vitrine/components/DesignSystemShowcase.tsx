import { useState, type ReactNode } from 'react';
import { Badge, SegmentedControl, SegmentedControlItem, Text } from '@astryxdesign/core';
import type { DesignToken, ReviewStatus, TokenKind } from '../../designSystem.ts';

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
  effect: 'Effects & elevation',
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

export function ReviewFooter({ confidence, reviewStatus }: { confidence?: number; reviewStatus?: ReviewStatus }) {
  if (confidence == null && !reviewStatus) return null;
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
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function TokenMeta<E>({ token, renderEvidence }: { token: DesignToken<E>; renderEvidence: (evidence: E[]) => ReactNode }) {
  return (
    <div className="ds-token__meta">
      <div className="ds-token__name">{token.name}</div>
      <code>{token.value}</code>
      <p>{token.role}</p>
      {renderEvidence(token.evidence)}
      <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} />
    </div>
  );
}

export function ColorSection<E>({ index, tokens, renderEvidence }: {
  index: number;
  tokens: DesignToken<E>[];
  renderEvidence: (evidence: E[]) => ReactNode;
}) {
  return (
    <section className="ds-section">
      <SectionHeading index={index} title="Color palette" description="Core colors and the roles they play across the product." />
      <div className="ds-colors">
        {tokens.map((token) => (
          <article className="ds-color" key={token.id}>
            <div className="ds-color__swatch" style={{ background: safeColor(token.value, 'var(--ds-muted)') }} />
            <TokenMeta token={token} renderEvidence={renderEvidence} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function TypographySection<E>({ index, tokens, renderEvidence }: {
  index: number;
  tokens: DesignToken<E>[];
  renderEvidence: (evidence: E[]) => ReactNode;
}) {
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
              <TokenMeta token={token} renderEvidence={renderEvidence} />
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
  return <div className="ds-foundation__effect" style={{ boxShadow: token.value }} />;
}

export function FoundationSection<E>({ index, kind, tokens, renderEvidence }: {
  index: number;
  kind: TokenKind;
  tokens: DesignToken<E>[];
  renderEvidence: (evidence: E[]) => ReactNode;
}) {
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
            <TokenMeta token={token} renderEvidence={renderEvidence} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function ThemeCanvas({ title, description, showcase, children }: {
  title: string;
  description: string;
  showcase?: ReactNode;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<'light' | 'dark'>('dark');
  return (
    <>
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
