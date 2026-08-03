import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Code, Heading, Text } from '@astryxdesign/core';
import {
  FOUNDATION_TOKEN_CONTRACT,
  UI_FOUNDATION_AREAS,
  UI_FOUNDATION_STANDARD,
} from '../../vitrine/uiFoundationStandard';

const meta = {
  title: 'Foundations/Standards',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The canonical Vitrines foundation contract. These rules apply to every signed-in product surface before component or workflow-specific styling.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const page: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-8)',
  padding: 'var(--spacing-8)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-family-body)',
};

const cards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 'var(--spacing-4)',
};

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-3)',
  padding: 'var(--spacing-5)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--radius-container)',
  background: 'var(--color-background-surface)',
  boxShadow: 'var(--shadow-low)',
};

function Header({ title, description }: { title: string; description: string }) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', maxWidth: '76ch' }}>
      <div style={{ display: 'flex', alignSelf: 'flex-start' }}>
        <Badge variant="neutral" label={`${UI_FOUNDATION_STANDARD.modes.length} themes · neutral-first`} />
      </div>
      <Heading level={1} type="display-3">{title}</Heading>
      <Text type="large" color="secondary">{description}</Text>
    </header>
  );
}

export const Principles: Story = {
  render: () => (
    <main style={page}>
      <Header
        title="One foundation for Vitrines"
        description="Every screen uses the same semantic language. Foundations define the available choices; components and product patterns compose them."
      />
      <section style={cards} aria-label="Foundation areas">
        {UI_FOUNDATION_AREAS.map((area, index) => (
          <article key={area.id} style={card}>
            <Text type="supporting" color="secondary">0{index + 1}</Text>
            <Heading level={3}>{area.name}</Heading>
            <Text type="body" color="secondary">{area.intent}</Text>
            <ul style={{ display: 'grid', gap: 'var(--spacing-2)', margin: 0, paddingInlineStart: 'var(--spacing-5)' }}>
              {area.rules.map((rule) => <li key={rule}><Text type="body">{rule}</Text></li>)}
            </ul>
          </article>
        ))}
      </section>
    </main>
  ),
};

export const TokenContract: Story = {
  name: 'Token contract',
  render: () => (
    <main style={page}>
      <Header
        title="Semantic tokens are the API"
        description="Application code consumes these roles from the shared package. Literal values belong in the theme implementation, not inside product screens."
      />
      <section style={cards} aria-label="Required token groups">
        {Object.entries(FOUNDATION_TOKEN_CONTRACT).map(([group, tokens]) => (
          <article key={group} style={card}>
            <Heading level={3}>{group[0].toUpperCase() + group.slice(1)}</Heading>
            <Text type="supporting" color="secondary">{tokens.length} required roles</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
              {tokens.map((token) => <Code key={token}>{token}</Code>)}
            </div>
          </article>
        ))}
      </section>
    </main>
  ),
};

export const DecisionOrder: Story = {
  name: 'Decision order',
  render: () => (
    <main style={page}>
      <Header
        title="How to make a UI decision"
        description="Use the first matching layer. A new local style is the last resort and must become a documented system decision if it repeats."
      />
      <ol style={{ ...cards, margin: 0, padding: 0, listStyle: 'none' }}>
        {[
          ['Use an existing component', 'Start with the shared component and its documented variants and states.'],
          ['Compose a product pattern', 'Combine existing components using spacing, sizing, and layout tokens.'],
          ['Add a reusable variant', 'When a repeated need is missing, add the smallest named variant and document it in Storybook.'],
          ['Extend the foundation', 'Add a token only when the choice is semantic, reusable, and cannot map to the current scale.'],
        ].map(([title, description], index) => (
          <li key={title} style={card}>
            <Text type="supporting" color="secondary">Step {index + 1}</Text>
            <Heading level={3}>{title}</Heading>
            <Text type="body" color="secondary">{description}</Text>
          </li>
        ))}
      </ol>
    </main>
  ),
};
