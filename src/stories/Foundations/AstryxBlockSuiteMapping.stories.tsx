import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroButton } from '../../vitrine/components/HeroButton';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
} from '../../vitrine/components/AstryxDropdown';
import { AstryxInputText } from '../../vitrine/components/SearchTrigger';
import '../../vitrine/styles.css';
import '../../vitrine/referenceDiscovery.css';
import '../../vitrine/components/AstryxDropdown.css';
import './AstryxBlockSuiteMapping.css';

const meta = {
  title: 'Foundations/Astryx BlockSuite mapping',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The ownership and theming boundary between Astryx product controls and BlockSuite editor internals.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function CodeList({ children }: { children: string[] }) {
  return (
    <div className="astryx-blocksuite-map__code-list">
      {children.map((value) => <code key={value}>{value}</code>)}
    </div>
  );
}

function MappingRow({
  name,
  preview,
  blocksuite,
  ownership,
  rule,
}: {
  name: string;
  preview: ReactNode;
  blocksuite: string[];
  ownership: 'Astryx shell' | 'BlockSuite-owned';
  rule: string;
}) {
  return (
    <article className="astryx-blocksuite-map__row">
      <div className="astryx-blocksuite-map__astryx">
        <strong>{name}</strong>
        <div className="astryx-blocksuite-map__preview">{preview}</div>
      </div>
      <div className="astryx-blocksuite-map__counterpart">
        <span className="astryx-blocksuite-map__mobile-label">
          BlockSuite counterpart
        </span>
        <CodeList>{blocksuite}</CodeList>
      </div>
      <div className="astryx-blocksuite-map__decision">
        <span
          className="astryx-blocksuite-map__ownership"
          data-owner={ownership === 'Astryx shell' ? 'astryx' : 'blocksuite'}
        >
          {ownership}
        </span>
        <p>{rule}</p>
      </div>
    </article>
  );
}

function ComponentMapping() {
  const [primaryDropdownOpen, setPrimaryDropdownOpen] = useState(false);
  const [secondaryDropdownOpen, setSecondaryDropdownOpen] = useState(false);

  return (
    <main className="astryx-blocksuite-map">
      <header className="astryx-blocksuite-map__intro">
        <p className="astryx-blocksuite-map__eyebrow">
          Astryx · Project Docs
        </p>
        <h1>Astryx ↔ BlockSuite component mapping</h1>
        <p>
          Astryx owns the product shell. BlockSuite owns editor behavior inside
          <code>page-editor</code> and <code>edgeless-editor</code>.
        </p>
      </header>

      <section className="astryx-blocksuite-map__table" aria-label="Component mapping">
        <div className="astryx-blocksuite-map__head" aria-hidden="true">
          <span>Astryx standard</span>
          <span>BlockSuite counterpart</span>
          <span>Integration rule</span>
        </div>

        <MappingRow
          name="Primary button"
          preview={<HeroButton primary onClick={() => {}}>Share</HeroButton>}
          blocksuite={['No direct primary-action primitive']}
          ownership="Astryx shell"
          rule="Keep primary product actions in Astryx. Do not replace BlockSuite toolbar controls with a primary CTA."
        />

        <MappingRow
          name="Secondary button"
          preview={<HeroButton onClick={() => {}}>Comments</HeroButton>}
          blocksuite={[
            'editor-icon-button',
            'icon-button',
            'edgeless-toolbar-button',
          ]}
          ownership="BlockSuite-owned"
          rule="Match color, radius, hover, and focus through the AFFiNE token bridge; preserve BlockSuite events and keyboard behavior."
        />

        <MappingRow
          name="Primary dropdown"
          preview={(
            <AstryxDropdown
              label="Page"
              ariaLabel="Document view: Page"
              open={primaryDropdownOpen}
              triggerVariant="primary"
              onOpenChange={setPrimaryDropdownOpen}
            >
              <AstryxDropdownItem
                label="Page"
                selected
                onSelect={() => setPrimaryDropdownOpen(false)}
              />
              <AstryxDropdownItem
                label="Canvas"
                onSelect={() => setPrimaryDropdownOpen(false)}
              />
            </AstryxDropdown>
          )}
          blocksuite={['No primary-emphasis dropdown role', 'editor-menu-button']}
          ownership="Astryx shell"
          rule="Use Astryx for document scope and mode selection. BlockSuite menu triggers remain compact editor tools."
        />

        <MappingRow
          name="Secondary dropdown"
          preview={(
            <AstryxDropdown
              label="Insert"
              ariaLabel="Open Insert menu"
              open={secondaryDropdownOpen}
              triggerVariant="secondary"
              onOpenChange={setSecondaryDropdownOpen}
            >
              <AstryxDropdownItem
                label="Table"
                onSelect={() => setSecondaryDropdownOpen(false)}
              />
              <AstryxDropdownItem
                label="Callout"
                onSelect={() => setSecondaryDropdownOpen(false)}
              />
            </AstryxDropdown>
          )}
          blocksuite={[
            'editor-menu-button',
            'edgeless-toolbar-button',
            'edgeless-tool-icon-button',
          ]}
          ownership="BlockSuite-owned"
          rule="Treat these as the closest semantic equivalent. Theme the trigger; do not wrap or replace the internal web component."
        />

        <MappingRow
          name="Input text"
          preview={(
            <AstryxInputText
              label="Search blocks…"
              ariaLabel="Search blocks"
              onOpen={() => {}}
            />
          )}
          blocksuite={[
            'affine-menu-input',
            '.affine-menu-search',
            'comment-input',
          ]}
          ownership="BlockSuite-owned"
          rule="Bridge input background, border, placeholder, active, and focus tokens. Keep BlockSuite composition and shortcut handling."
        />

        <MappingRow
          name="Dropdown menu"
          preview={(
            <div
              className="astryx-dropdown astryx-blocksuite-map__menu-preview"
              role="menu"
              aria-label="Astryx dropdown menu example"
            >
              <AstryxDropdownItem label="Copy" onSelect={() => {}} />
              <AstryxDropdownItem label="Duplicate" onSelect={() => {}} />
              <AstryxDropdownDivider />
              <AstryxDropdownItem
                label="Delete"
                tone="destructive"
                onSelect={() => {}}
              />
            </div>
          )}
          blocksuite={[
            'affine-menu',
            'affine-menu-button',
            'affine-menu-sub-menu',
            'menu-divider',
          ]}
          ownership="BlockSuite-owned"
          rule="This is the closest direct mapping. Theme the menu surface and item states with AFFiNE variables; never fork the menu implementation."
        />
      </section>

      <footer className="astryx-blocksuite-map__boundary">
        <strong>Boundary rule</strong>
        <span>
          Outside the editor roots: compose Astryx components. Inside the editor
          roots: preserve BlockSuite components and bridge design tokens only.
        </span>
      </footer>
    </main>
  );
}

export const Overview: Story = {
  render: () => <ComponentMapping />,
};
