import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
  AstryxDropdownPanel,
} from './components/AstryxDropdown.tsx';

test('allows the trigger to use the Astryx primary button variant', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdown
      label="iOS"
      ariaLabel="Flow platform: iOS"
      open={false}
      triggerVariant="primary"
      onOpenChange={() => undefined}
    >
      <AstryxDropdownItem label="iOS" selected onSelect={() => undefined} />
    </AstryxDropdown>,
  );

  assert.match(html, /aria-label="Flow platform: iOS"/);
  assert.match(html, /data-variant="primary"/);
  assert.match(html, /astryx-dropdown-trigger--primary/);
});

test('uses the outlined secondary dropdown treatment by default', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdown
      label="Categories"
      ariaLabel="Open Categories filters"
      open={false}
      onOpenChange={() => undefined}
    >
      <AstryxDropdownItem label="Business" onSelect={() => undefined} />
    </AstryxDropdown>,
  );

  assert.match(html, /data-variant="secondary"/);
  assert.match(html, /astryx-dropdown-trigger--secondary/);
});

test('renders a compact selected dropdown item with a visible selection affordance', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdownItem label="Web" selected onSelect={() => undefined} />,
  );

  assert.match(html, /role="menuitem"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /astryx-dropdown__item--selected/);
  assert.match(html, /aria-label="Selected"/);
});

test('renders destructive menu actions through the shared item treatment', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdownItem
      label="Delete"
      tone="destructive"
      onSelect={() => undefined}
    />,
  );

  assert.match(html, /astryx-dropdown__item--destructive/);
  assert.match(html, />Delete</);
});

test('routes product dropdown menus through the shared Astryx menu surface', async () => {
  const productMenuFiles = [
    './Home.tsx',
    './Pricing.tsx',
    './components/CollectionPicker.tsx',
    './components/UserDirectory.tsx',
    './components/ProjectDocumentLibrary.tsx',
    './components/ProjectDocumentWorkspace.tsx',
  ];

  for (const path of productMenuFiles) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<DropdownMenu(?:\s|>)/, path);
    assert.match(source, /<AstryxMenu(?:\s|>)/, path);
  }
});

test('renders the shared dropdown section divider', () => {
  const html = renderToStaticMarkup(<AstryxDropdownDivider />);

  assert.match(html, /class="astryx-dropdown__divider"/);
  assert.match(html, /role="separator"/);
});

test('renders the shared searchable dropdown panel surface', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdownPanel ariaLabel="Categories filters">
      <div>Searchable content</div>
    </AstryxDropdownPanel>,
  );

  assert.match(html, /class="astryx-dropdown-panel"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-label="Categories filters"/);
});

test('uses the shared dropdown trigger for searchable panels', () => {
  const html = renderToStaticMarkup(
    <AstryxDropdown
      mode="panel"
      label="Flow groups"
      ariaLabel="Open Flow groups filters"
      panelAriaLabel="Flow groups filters"
      open
      onOpenChange={() => undefined}
    >
      <div>Searchable flow groups</div>
    </AstryxDropdown>,
  );

  assert.match(html, /aria-label="Open Flow groups filters"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="[^"]+"/);
  assert.match(html, /role="dialog"[^>]*aria-label="Flow groups filters"/);
  assert.match(html, /Searchable flow groups/);
});

test('uses Astryx semantic tokens for the shared dropdown appearance', async () => {
  const css = await readFile(
    new URL('./components/AstryxDropdown.css', import.meta.url),
    'utf8',
  );

  assert.match(
    css,
    /\.astryx-dropdown-trigger--secondary\s*\{[^}]*border:\s*1px solid var\(--color-border-emphasized\)[^}]*background:\s*var\(--color-background-body\)/s,
  );
  assert.match(
    css,
    /\.astryx-dropdown\s*\{[^}]*background:\s*var\(--color-background-popover\)/s,
  );
  assert.match(
    css,
    /\.astryx-dropdown__item:hover,[^}]*\{[^}]*background:\s*var\(--color-overlay-hover\)/s,
  );
  assert.match(
    css,
    /\.astryx-dropdown-panel\s*\{[^}]*background:\s*var\(--color-background-popover\)/s,
  );
});
