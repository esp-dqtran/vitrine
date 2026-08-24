import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AstryxDropdown,
  AstryxDropdownDivider,
  AstryxDropdownItem,
  AstryxDropdownPanel,
  AstryxSingleSelectDropdown,
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
  assert.match(html, /data-size="sm"/);
});

test('uses the shared dropdown for compact single-select controls', () => {
  const html = renderToStaticMarkup(
    <AstryxSingleSelectDropdown
      ariaLabel="App version"
      value="latest"
      options={[
        { value: 'latest', label: 'Latest' },
        { value: '1', label: 'Version 1' },
      ]}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /aria-label="App version: Latest"/);
  assert.match(html, /astryx-dropdown-trigger/);
  assert.doesNotMatch(html, /astryx-selector/);
});

test('routes compact product selectors through the shared single-select dropdown', async () => {
  const productFiles = [
    './components/ScreenDetail.tsx',
    './components/SiteVersionPage.tsx',
    './components/AdvancedSearchPage.tsx',
    './components/UserDirectory.tsx',
  ];

  for (const path of productFiles) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /<AstryxSingleSelectDropdown(?:\s|>)/, path);
  }
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
    './components/UserDirectory.tsx',
  ];

  for (const path of productMenuFiles) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<DropdownMenu(?:\s|>)/, path);
    assert.match(source, /<AstryxMenu(?:\s|>)/, path);
  }
});

test('uses a focused modal rather than a dropdown to save a screen to a collection', async () => {
  const source = await readFile(
    new URL('./components/CollectionPicker.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /<AstryxMenu(?:\s|>)/);
  assert.doesNotMatch(source, /<DropdownMenu(?:\s|>)/);
  assert.match(source, /<AstryxModal(?:\s|>)/);
  assert.match(source, /Use in project/);
  assert.match(source, /Create new collection/);
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
  assert.match(html, /data-state="open"/);
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
  assert.match(
    css,
    /\.astryx-dropdown-panel\s*\{[^}]*width:\s*min\(288px,\s*calc\(100vw - 48px\)\)[^}]*animation:\s*astryx-dropdown-in 180ms/s,
  );
  assert.match(
    css,
    /\.astryx-dropdown\s*\{[^}]*animation:\s*astryx-dropdown-in 180ms/s,
  );
  assert.match(css, /@keyframes astryx-dropdown-in\s*\{/);
  assert.match(css, /@keyframes astryx-dropdown-out\s*\{/);
  assert.match(
    css,
    /\.astryx-dropdown-panel\[data-state='closing'\]\s*\{[^}]*pointer-events:\s*none[^}]*animation-name:\s*astryx-dropdown-out/s,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.astryx-dropdown-panel\s*\{[^}]*animation:\s*none/s,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.astryx-dropdown-panel\[data-state='closing'\]\s*\{[^}]*visibility:\s*hidden/s,
  );
});
