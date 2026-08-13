import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CollectionPicker } from '../../vitrine/components/CollectionPicker.tsx';
import type { ResearchCollection } from '../../db.ts';
import '../../vitrine/styles.css';

const initialCollections: ResearchCollection[] = [
  {
    id: 1,
    name: 'Saved',
    description: 'Screens and references saved from Vitrines.',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    items: [],
  },
  {
    id: 2,
    name: 'Onboarding patterns',
    description: 'References for onboarding research.',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    items: [],
  },
  {
    id: 3,
    name: 'Permission flows',
    description: 'References for access and roles.',
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    items: [],
  },
];

const meta = {
  title: 'Patterns/Save to collection',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function CollectionPickerPreview() {
  const [collections, setCollections] = useState(initialCollections);

  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 320 }}>
      <strong>Screen capture</strong>
      <span style={{ color: 'var(--color-text-secondary)' }}>
        Choose a personal collection before saving.
      </span>
      <CollectionPicker
        reference={{
          kind: 'screen',
          app: 'vitrines',
          referenceId: 'preview-screen',
          title: 'Permissions setup',
        }}
        collections={collections}
        onCollectionsChange={setCollections}
        plan="pro"
        buttonLabel="Save"
        buttonVariant="primary"
      />
    </div>
  );
}

export const Modal: Story = {
  render: () => <CollectionPickerPreview />,
};
