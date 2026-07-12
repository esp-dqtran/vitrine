import { EmptyState, Spinner } from '@astryxdesign/core';
import type { DesignSystemSnapshot, EvidenceView, TokenKind } from '../../designSystem';

const LABELS: Record<TokenKind, string> = {
  color: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radii',
  border: 'Borders',
  effect: 'Effects',
};

interface DesignSystemPanelProps {
  snapshot: DesignSystemSnapshot<EvidenceView> | null;
  status: 'loading' | 'ready' | 'missing' | 'error';
}

export function DesignSystemPanel({ snapshot, status }: DesignSystemPanelProps) {
  if (status === 'loading') return <Spinner size="lg" />;
  if (!snapshot) {
    return <EmptyState title="No design system yet" description="Complete structured synthesis to publish observed foundations." />;
  }

  const kinds = [...new Set(snapshot.tokens.map((token) => token.kind))];
  if (kinds.length === 0 && !snapshot.rules?.length) {
    return <EmptyState title="No observed foundations" description="No reviewed token evidence is available for this app." />;
  }

  return (
    <div style={{ display: 'grid', gap: 32, paddingTop: 28 }}>
      {kinds.map((kind) => (
        <section key={kind}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px' }}>{LABELS[kind]}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {snapshot.tokens.filter((token) => token.kind === kind).map((token) => (
              <article
                key={token.id}
                style={{
                  padding: 16,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-container)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 650 }}>{token.name}</div>
                <code style={{ display: 'block', marginTop: 6 }}>{token.value}</code>
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{token.role}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-disabled)' }}>
                  {token.evidence.length} source screen{token.evidence.length === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>{token.evidence.map((evidence) => <a key={evidence.imageId} href={evidence.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: 'var(--color-accent)' }}>Screen {evidence.imageId}</a>)}</div>
                {(token.confidence != null || token.reviewStatus) && <div style={{ marginTop: 7, fontSize: 10.5, color: 'var(--color-text-disabled)' }}>{token.reviewStatus ?? 'needs review'}{token.confidence != null ? ` · ${Math.round(token.confidence * 100)}% confidence` : ''}</div>}
                {(token.evidence.some(({ capturedAt }) => capturedAt) || token.responsiveViewports?.length) && <div style={{ marginTop: 5, fontSize: 10.5, color: 'var(--color-text-disabled)' }}>{token.evidence.some(({ capturedAt }) => capturedAt) ? `Last captured ${new Date(Math.max(...token.evidence.flatMap(({ capturedAt }) => capturedAt ? [Date.parse(capturedAt)] : []))).toLocaleDateString()}` : ''}{token.responsiveViewports?.length ? ` · ${token.responsiveViewports.join(', ')}` : ''}</div>}
              </article>
            ))}
          </div>
        </section>
      ))}
      {(snapshot.rules?.length ?? 0) > 0 && <section><h2 style={{ fontSize: 20, margin: '0 0 14px' }}>Observed patterns</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>{snapshot.rules!.map((rule) => <article key={rule.id} style={{ padding: 16, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-container)' }}><div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-disabled)' }}>{rule.kind}</div><div style={{ marginTop: 4, fontWeight: 650 }}>{rule.name}</div><p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{rule.description}</p><div style={{ display: 'flex', gap: 5 }}>{rule.evidence.map((evidence) => <a key={evidence.imageId} href={evidence.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5 }}>Screen {evidence.imageId}</a>)}</div></article>)}</div></section>}
    </div>
  );
}
