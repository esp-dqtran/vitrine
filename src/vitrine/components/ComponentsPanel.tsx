import { EmptyState } from '@astryxdesign/core';
import type { DesignComponent, EvidenceView } from '../../designSystem';
import { ElementCard } from './ElementCard';

export function ComponentsPanel({ components }: { components: DesignComponent<EvidenceView>[] }) {
  if (components.length === 0) {
    return <EmptyState title="No observed components" description="This app has no reviewed component evidence yet." />;
  }

  const categories = [...new Set(components.map((component) => component.category))];
  return (
    <>
      {categories.map((category, categoryIndex) => {
        const items = components.filter((component) => component.category === category);
        return (
          <section
            key={category}
            style={{ padding: '36px 0', borderTop: categoryIndex ? '1px solid var(--color-border)' : 'none' }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {category}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {items.length} component{items.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
              {items.map((component) => <ElementCard key={component.id} component={component} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
