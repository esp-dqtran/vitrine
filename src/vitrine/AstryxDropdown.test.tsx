import assert from 'node:assert/strict';
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
