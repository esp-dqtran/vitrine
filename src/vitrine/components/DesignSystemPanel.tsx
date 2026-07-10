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
  if (kinds.length === 0) {
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
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
