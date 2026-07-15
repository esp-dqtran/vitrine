import { useState, type CSSProperties } from 'react';
import { Badge, Card, Divider, EmptyState, SegmentedControl, SegmentedControlItem, Spinner, Text } from '@astryxdesign/core';
import type { ComponentVariant, DesignSystemSnapshot, EvidenceView, ReviewStatus, TokenKind } from '../../designSystem';

const KIND_LABELS: Record<TokenKind, string> = {
  color: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radii',
  border: 'Borders',
  effect: 'Effects',
};

const REVIEW_VARIANT: Record<ReviewStatus, 'success' | 'warning' | 'error'> = {
  reviewed: 'success',
  needs_review: 'warning',
  rejected: 'error',
};

const pxValue = (value: string): number | undefined => {
  const match = /(-?\d+(?:\.\d+)?)\s*px/.exec(value);
  return match ? Number(match[1]) : undefined;
};

function EvidenceLinks({ evidence }: { evidence: EvidenceView[] }) {
  if (!evidence.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <Text as="div" type="supporting" color="secondary">{evidence.length} source screen{evidence.length === 1 ? '' : 's'}</Text>
      <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
        {evidence.map((item) => (
          <a key={item.imageId} href={item.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: 'var(--color-text-accent)' }}>
            Screen {item.imageId}
          </a>
        ))}
      </div>
    </div>
  );
}

function ReviewFooter({ confidence, reviewStatus }: { confidence?: number; reviewStatus?: ReviewStatus }) {
  if (confidence == null && !reviewStatus) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
      {reviewStatus ? <Badge variant={REVIEW_VARIANT[reviewStatus]} label={reviewStatus === 'reviewed' ? 'Reviewed' : reviewStatus === 'rejected' ? 'Rejected' : 'Needs review'} /> : null}
      {confidence != null ? <Text type="supporting" color="secondary">{Math.round(confidence * 100)}% confidence</Text> : null}
    </div>
  );
}

function SectionEyebrow({ index, label }: { index: number; label: string }) {
  return (
    <Text type="label" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {String(index).padStart(2, '0')} — {label}
    </Text>
  );
}

function TokenPreview({ token }: { token: DesignSystemSnapshot<EvidenceView>['tokens'][number] }) {
  if (token.kind === 'color') {
    return <div style={{ height: 40, borderRadius: 8, background: token.value, border: '1px solid var(--color-border)' }} />;
  }
  if (token.kind === 'typography') {
    const size = Math.min(pxValue(token.value) ?? 16, 32);
    return <Text as="div" style={{ fontSize: size, lineHeight: 1.2 }}>{token.name}</Text>;
  }
  if (token.kind === 'spacing') {
    const width = Math.max(4, Math.min(pxValue(token.value) ?? 16, 160));
    return <div style={{ height: 12, width, borderRadius: 3, background: 'var(--color-accent)' }} />;
  }
  if (token.kind === 'radius') {
    const radius = pxValue(token.value) ?? 0;
    return <div style={{ height: 36, width: 36, borderRadius: radius, background: 'var(--color-background-muted)', border: '1px solid var(--color-border-emphasized)' }} />;
  }
  if (token.kind === 'border') {
    const width = pxValue(token.value) ?? 1;
    return <div style={{ height: 36, width: 36, borderRadius: 6, border: `${width}px solid var(--color-text-primary)` }} />;
  }
  return <div style={{ height: 36, width: 56, borderRadius: 6, background: 'var(--color-background-surface)', boxShadow: token.value }} />;
}

function ColorSection({ index, tokens }: { index: number; tokens: DesignSystemSnapshot<EvidenceView>['tokens'] }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionEyebrow index={index} label="Colors" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {tokens.map((token) => (
          <Card key={token.id} padding={3}>
            <TokenPreview token={token} />
            <Text as="div" type="label" style={{ marginTop: 10 }}>{token.name}</Text>
            <Text as="div" type="supporting" color="secondary" style={{ fontFamily: 'var(--font-family-code)' }}>{token.value}</Text>
            <Text as="div" type="supporting" color="secondary" style={{ marginTop: 4 }}>{token.role}</Text>
            <EvidenceLinks evidence={token.evidence} />
            <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} />
          </Card>
        ))}
      </div>
    </section>
  );
}

function FoundationSection({ index, label, tokens }: { index: number; label: string; tokens: DesignSystemSnapshot<EvidenceView>['tokens'] }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionEyebrow index={index} label={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {tokens.map((token) => (
          <Card key={token.id} padding={3} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 40 }}><TokenPreview token={token} /></div>
            <div>
              <Text as="div" type="label">{token.name}</Text>
              <Text as="div" type="supporting" color="secondary" style={{ fontFamily: 'var(--font-family-code)' }}>{token.value}</Text>
              <Text as="div" type="supporting" color="secondary" style={{ marginTop: 4 }}>{token.role}</Text>
            </div>
            <EvidenceLinks evidence={token.evidence} />
            <ReviewFooter confidence={token.confidence} reviewStatus={token.reviewStatus} />
          </Card>
        ))}
      </div>
    </section>
  );
}

function reconstructionStyle(spec: ComponentVariant<EvidenceView>['reconstruction']): CSSProperties {
  if (!spec) return { padding: 16, borderRadius: 8, background: 'var(--color-background-muted)', color: 'var(--color-text-disabled)', fontSize: 12 };
  return {
    display: 'flex',
    flexDirection: spec.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spec.gap,
    padding: spec.padding ?? 12,
    width: spec.width,
    height: spec.height,
    background: spec.fill || 'var(--color-background-muted)',
    border: spec.stroke ? `1px solid ${spec.stroke}` : undefined,
    borderRadius: spec.radius ?? 8,
    color: 'var(--color-text-primary)',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

function ComponentsSection({ index, components, stage }: { index: number; components: DesignSystemSnapshot<EvidenceView>['components']; stage: 'light' | 'dark' }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionEyebrow index={index} label="Components" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {components.map((component) => (
          <Card key={component.id} padding={4} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text as="div" type="label">{component.name}</Text>
              <Text as="div" type="supporting" color="secondary">{component.category}</Text>
            </div>
            <Text as="div" type="supporting" color="secondary">{component.description}</Text>
            <div style={{ display: 'grid', gap: 10 }}>
              {component.variants.map((variant) => (
                <div key={variant.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 10, borderRadius: 8, background: stage === 'dark' ? '#0b0b0d' : 'var(--color-background-muted)' }}>
                  <div style={{ flexShrink: 0 }}><div style={reconstructionStyle(variant.reconstruction)}>{variant.reconstruction?.visibleText}</div></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text as="div" type="supporting" style={{ fontWeight: 600 }}>{variant.name}</Text>
                    <Text as="div" type="supporting" color="secondary">{variant.description}</Text>
                    <EvidenceLinks evidence={variant.evidence} />
                    <ReviewFooter confidence={variant.confidence} reviewStatus={variant.reviewStatus} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function PatternsSection({ index, rules }: { index: number; rules: NonNullable<DesignSystemSnapshot<EvidenceView>['rules']> }) {
  const byKind = new Map<string, typeof rules>();
  for (const rule of rules) byKind.set(rule.kind, [...(byKind.get(rule.kind) ?? []), rule]);
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionEyebrow index={index} label="Patterns" />
      {[...byKind.entries()].map(([kind, kindRules]) => (
        <div key={kind} style={{ display: 'grid', gap: 10 }}>
          <Text as="div" type="label" color="secondary" style={{ textTransform: 'capitalize' }}>{kind}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {kindRules.map((rule) => (
              <Card key={rule.id} padding={3}>
                <Text as="div" type="label">{rule.name}</Text>
                <Text as="div" type="supporting" color="secondary" style={{ marginTop: 4 }}>{rule.description}</Text>
                <EvidenceLinks evidence={rule.evidence} />
                <ReviewFooter confidence={rule.confidence} reviewStatus={rule.reviewStatus} />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

interface DesignSystemPanelProps {
  snapshot: DesignSystemSnapshot<EvidenceView> | null;
  status: 'loading' | 'ready' | 'missing' | 'error';
}

export function DesignSystemPanel({ snapshot, status }: DesignSystemPanelProps) {
  const [stage, setStage] = useState<'light' | 'dark'>('dark');

  if (status === 'loading') return <Spinner size="lg" />;
  if (!snapshot) {
    return <EmptyState title="No design system yet" description="Complete structured synthesis to publish observed foundations." />;
  }

  const colorTokens = snapshot.tokens.filter((token) => token.kind === 'color');
  const foundationKinds = (['typography', 'spacing', 'radius', 'border', 'effect'] as TokenKind[])
    .map((kind) => [kind, snapshot.tokens.filter((token) => token.kind === kind)] as const)
    .filter(([, tokens]) => tokens.length > 0);
  const hasComponents = snapshot.components.length > 0;
  const hasRules = (snapshot.rules?.length ?? 0) > 0;

  if (colorTokens.length === 0 && foundationKinds.length === 0 && !hasComponents && !hasRules) {
    return <EmptyState title="No observed foundations" description="No reviewed token evidence is available for this app." />;
  }

  let sectionIndex = 0;
  return (
    <div style={{ display: 'grid', gap: 40, paddingTop: 28 }}>
      {hasComponents ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SegmentedControl value={stage} onChange={(value) => setStage(value as 'light' | 'dark')} label="Component preview background">
            <SegmentedControlItem value="light" label="Light" />
            <SegmentedControlItem value="dark" label="Dark" />
          </SegmentedControl>
        </div>
      ) : null}

      {colorTokens.length > 0 ? <ColorSection index={(sectionIndex += 1)} tokens={colorTokens} /> : null}
      {foundationKinds.map(([kind, tokens]) => <FoundationSection key={kind} index={(sectionIndex += 1)} label={KIND_LABELS[kind]} tokens={tokens} />)}
      {hasComponents ? <ComponentsSection index={(sectionIndex += 1)} components={snapshot.components} stage={stage} /> : null}
      {hasRules ? <PatternsSection index={(sectionIndex += 1)} rules={snapshot.rules!} /> : null}

      <Divider />
    </div>
  );
}
