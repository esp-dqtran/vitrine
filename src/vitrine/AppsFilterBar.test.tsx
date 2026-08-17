import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DiscoveryFilterBar,
  DiscoveryFilterMenu,
  DiscoveryFilterOptionCheckbox,
  DiscoveryPlatformFilterOptions,
  discoveryFilterVisibleOptions,
  closeDiscoveryMenuForKey,
  closeDiscoveryMenuForPointerDown,
  isInsideAstryxDropdownPortal,
  isOutsideDiscoveryFilterMenu,
  toggleDiscoveryMenu,
} from './components/AppsFilterBar.tsx';

const options = {
  categories: [{ value: 'Shopping', section: 'Categories' }],
  screens: [{ value: 'My Account & Profile', section: 'Account Management' }],
  elements: [{ value: 'Navigation Menu', section: 'UI Elements' }],
  flows: [{ value: 'Setting Up', section: 'Flows' }],
};

test('renders the compact sticky Apps filter controls and result summary', () => {
  const html = renderToStaticMarkup(
    <DiscoveryFilterBar
      kind="apps"
      ariaLabel="App discovery controls"
      platform={{ value: 'web', ariaLabel: 'App platform', onChange: () => undefined }}
      filters={[
        {
          id: 'categories',
          label: 'Categories',
          selected: ['Shopping', 'Business', 'AI'],
          options: options.categories,
        },
        {
          id: 'screens',
          label: 'Screens',
          selected: ['My Account & Profile'],
          options: options.screens,
        },
        { id: 'elements', label: 'UI Elements', selected: [], options: options.elements },
        { id: 'flows', label: 'Flows', selected: [], options: options.flows },
      ]}
      resultCount={27}
      resultLabels={['screen', 'screens']}
      showResultCount
      sort="trending"
      sortOptions={[
        { value: 'latest', label: 'Latest' },
        { value: 'trending', label: 'Trending' },
      ]}
      onSortChange={() => undefined}
      onToggleFilter={() => undefined}
      onClearFilter={() => undefined}
    />,
  );

  assert.match(html, /data-apps-filterbar="true"/);
  assert.match(html, /class="control-rail apps-filterbar"/);
  assert.match(html, /aria-label="App platform: Web"/);
  assert.match(html, />Categories</);
  assert.match(html, /apps-filterbar__selection-count[^>]*>3</);
  assert.match(html, /Filter \(3 selected\): Categories/);
  assert.match(html, /My Account &amp; Profile/);
  assert.match(html, /Clear Categories filters/);
  assert.match(html, /Clear Screens filter/);
  assert.match(html, /UI Elements/);
  assert.match(html, /Flows/);
  assert.match(html, /aria-label="Filters \(4 selected\)"/);
  assert.match(html, /apps-filterbar__filter--merged/);
  assert.match(html, /27 screens/);
  assert.match(html, /Trending/);
});

test('keeps DiscoveryFilterBar generic across discovery kinds', () => {
  const html = renderToStaticMarkup(
    <DiscoveryFilterBar
      kind="sites"
      ariaLabel="Site discovery controls"
      platform={{ value: 'web', ariaLabel: 'Site platform', onChange: () => undefined }}
      filters={[{
        id: 'styles',
        label: 'Styles',
        selected: ['Minimal', 'Dark'],
        options: [],
      }]}
      resultCount={2}
      resultLabels={['site', 'sites']}
      showResultCount
      sort="latest"
      sortOptions={[{ value: 'latest', label: 'Latest' }]}
      onSortChange={() => undefined}
      onToggleFilter={() => undefined}
      onClearFilter={() => undefined}
    />,
  );

  assert.match(html, /data-discovery-filterbar="sites"/);
  assert.match(html, /data-sites-filterbar="true"/);
  assert.match(html, /Filter \(2 selected\): Styles/);
  assert.match(html, /apps-filterbar__selection-count[^>]*>2</);
  assert.match(html, /2 sites/);
});

test('supports a primary filter and a right-aligned toolbar action', () => {
  const html = renderToStaticMarkup(
    <DiscoveryFilterBar
      kind="colors"
      ariaLabel="Color discovery controls"
      platform={{ value: 'web', ariaLabel: 'Color surface', onChange: () => undefined }}
      filters={[{
        id: 'color-types',
        label: 'Type',
        selected: ['Mono'],
        selectionMode: 'single',
        allowClear: false,
        options: [
          { value: 'Mono', section: 'Palette type' },
          { value: 'Gradient', section: 'Palette type' },
        ],
      }]}
      primaryFilterId="color-types"
      actions={<button type="button">Create post</button>}
      resultCount={2}
      resultLabels={['palette', 'palettes']}
      showPlatform={false}
      showSort={false}
      sort="curated"
      sortOptions={[]}
      onSortChange={() => undefined}
      onToggleFilter={() => undefined}
      onClearFilter={() => undefined}
    />,
  );

  assert.match(html, /apps-filterbar__filter--primary/);
  assert.match(html, /astryx-dropdown-trigger--primary/);
  assert.match(html, /aria-label="Type: Mono"/);
  assert.match(html, />Mono</);
  assert.match(html, />Gradient</);
  assert.doesNotMatch(html, /Search Type|type="checkbox"|Clear Type filter/);
  assert.match(html, />Create post</);
});

test('can omit platform and sort controls for a web-only Sites catalog', () => {
  const html = renderToStaticMarkup(
    <DiscoveryFilterBar
      kind="sites"
      ariaLabel="Site discovery controls"
      platform={{ value: 'web', ariaLabel: 'Site platform', onChange: () => undefined }}
      filters={[]}
      resultCount={2}
      resultLabels={['site', 'sites']}
      showPlatform={false}
      showSort={false}
      sort="latest"
      sortOptions={[{ value: 'latest', label: 'Latest' }]}
      onSortChange={() => undefined}
      onToggleFilter={() => undefined}
      onClearFilter={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /aria-label="Site platform: Web"/);
  assert.doesNotMatch(html, /aria-label="Sort: Latest"/);
});

test('only renders generic DiscoveryFilterBar result meta when explicitly requested', () => {
  const props = {
    kind: 'sites' as const,
    ariaLabel: 'Site discovery controls',
    platform: { value: 'web' as const, ariaLabel: 'Site platform', onChange: () => undefined },
    filters: [],
    resultCount: 2,
    resultLabels: ['site', 'sites'] as const,
    sort: 'latest',
    sortOptions: [{ value: 'latest', label: 'Latest' }],
    onSortChange: () => undefined,
    onToggleFilter: () => undefined,
    onClearFilter: () => undefined,
  };
  const hidden = renderToStaticMarkup(<DiscoveryFilterBar {...props} />);
  const shown = renderToStaticMarkup(<DiscoveryFilterBar {...props} showResultCount />);

  assert.doesNotMatch(hidden, /apps-filterbar__count/);
  assert.match(shown, /apps-filterbar__count/);
  assert.match(shown, /2 sites/);
});

test('renders every Apps filter option as a real checkbox', () => {
  const html = renderToStaticMarkup(
    <>
      <DiscoveryFilterOptionCheckbox
        option={{ value: 'AI', section: 'Categories', swatches: ['#3157D5', '#F5DF4D'] }}
        selected
        onPreview={() => undefined}
        onToggle={() => undefined}
      />
      <DiscoveryFilterOptionCheckbox
        option={{ value: 'Finance', section: 'Categories' }}
        selected={false}
        onPreview={() => undefined}
        onToggle={() => undefined}
      />
    </>,
  );

  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.match(html, /type="checkbox"[^>]*checked=""/);
  assert.doesNotMatch(html, /data-pinned/);
  assert.match(html, />AI</);
  assert.match(html, />Finance</);
  assert.match(html, /apps-filterbar__option-swatch/);
  assert.match(html, /background-color:#3157D5/);
  assert.match(html, /background-color:#F5DF4D/);
});

test('exports the exact Apps filter menu for reuse by detail pages', () => {
  const html = renderToStaticMarkup(
    <DiscoveryFilterMenu
      group={{
        id: 'screens',
        label: 'Screens',
        selected: [],
        options: [{ value: 'Checkout', section: 'Screen types' }],
      }}
      open
      query=""
      preview={null}
      onToggleOpen={() => undefined}
      onQueryChange={() => undefined}
      onPreview={() => undefined}
      onToggleOption={() => undefined}
      onClear={() => undefined}
    />,
  );

  assert.match(html, /class="discovery-filter-control apps-filterbar__filter /);
  assert.match(html, /class="[^"]*apps-filterbar__filter-button/);
  assert.match(html, /aria-label="Open Screens filters"/);
  assert.match(html, /role="dialog"[^>]*aria-label="Screens filters"/);
  assert.match(html, /placeholder="Search screens…"/);
  assert.match(html, /<h3>Screen types<\/h3>/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /app-detail-screen-filter/);
});

test('bounds a large filter menu while searching across its complete option set', () => {
  const manyOptions = Array.from({ length: 5_880 }, (_, index) => ({
    value: `Flow group ${String(index).padStart(4, '0')}`,
    section: 'Flow groups',
  }));

  const defaults = discoveryFilterVisibleOptions(manyOptions, '', ['Flow group 5879']);
  assert.equal(defaults.length, 200);
  assert.equal(defaults[0]?.value, 'Flow group 5879', 'selected deep values stay actionable');
  assert.equal(defaults.some(({ value }) => value === 'Flow group 0199'), false);

  const searched = discoveryFilterVisibleOptions(manyOptions, '5879', []);
  assert.deepEqual(searched.map(({ value }) => value), ['Flow group 5879']);
});

test('opens a bounded Apps Flow menu and can find a deep Flow option', () => {
  const manyOptions = Array.from({ length: 5_880 }, (_, index) => ({
    value: `Flow group ${String(index).padStart(4, '0')}`,
    section: 'Flow groups',
  }));
  const renderMenu = (query: string) => renderToStaticMarkup(
    <DiscoveryFilterMenu
      group={{
        id: 'flows',
        label: 'Flows',
        selected: [],
        options: manyOptions,
      }}
      open
      query={query}
      preview={null}
      onToggleOpen={() => undefined}
      onQueryChange={() => undefined}
      onPreview={() => undefined}
      onToggleOption={() => undefined}
      onClear={() => undefined}
    />,
  );

  const defaults = renderMenu('');
  assert.equal((defaults.match(/type="checkbox"/g) ?? []).length, 200);
  assert.doesNotMatch(defaults, /Flow group 5879/);

  const deepSearch = renderMenu('5879');
  assert.equal((deepSearch.match(/type="checkbox"/g) ?? []).length, 1);
  assert.match(deepSearch, /Flow group 5879/);
});

test('searches Screen patterns by aliases without duplicating selected values', () => {
  const screenOptions = [
    {
      value: 'Home',
      section: 'Content',
      aliases: ['dashboard', 'landing'],
      description: 'Screens that present primary content.',
    },
    {
      value: 'Dashboard',
      section: 'Data',
      aliases: ['overview'],
      description: 'Screens that summarize important data.',
    },
  ];

  assert.deepEqual(
    discoveryFilterVisibleOptions(screenOptions, 'dashboard', [])
      .map(({ value }) => value),
    ['Home', 'Dashboard'],
  );

  const html = renderToStaticMarkup(
    <DiscoveryFilterMenu
      group={{
        id: 'screens',
        label: 'Screens',
        selected: ['Home'],
        options: screenOptions,
      }}
      open
      query=""
      preview={screenOptions[0]!}
      onToggleOpen={() => undefined}
      onQueryChange={() => undefined}
      onPreview={() => undefined}
      onToggleOption={() => undefined}
      onClear={() => undefined}
    />,
  );

  assert.equal((html.match(/>Home</g) ?? []).length, 2);
  assert.doesNotMatch(html, /apps-filterbar__selected-options/);
  assert.match(html, /Screens that present primary content/);
});

test('keeps tablet filter popovers outside a clipping scroll container', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const tabletStart = css.indexOf('@media (min-width: 721px) and (max-width: 1080px)');
  const phoneStart = css.indexOf('@media (max-width: 720px)', tabletStart);
  assert.notEqual(tabletStart, -1);
  assert.notEqual(phoneStart, -1);
  const tabletCss = css.slice(tabletStart, phoneStart);

  assert.doesNotMatch(
    tabletCss,
    /\[data-filter-group='flows'\]\s*\{[^}]*display:\s*none/,
  );
  assert.doesNotMatch(
    tabletCss,
    /\.apps-filterbar__controls\s*\{[^}]*overflow-x:\s*auto/,
  );
  assert.match(
    tabletCss,
    /\.apps-filterbar\s*\{[^}]*flex-wrap:\s*wrap/,
  );
  assert.match(
    tabletCss,
    /\.apps-filterbar__controls\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow:\s*visible/,
  );
});

test('renders the Apps platforms as a single-select dropdown menu', () => {
  const html = renderToStaticMarkup(
    <DiscoveryPlatformFilterOptions
      value="ios"
      onSelect={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /Search Platforms/);
  assert.doesNotMatch(html, /<input/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 3);
  assert.match(html, /role="menuitem"[^>]*aria-current="true"[^>]*>[\s\S]*iOS/);
  assert.match(html, /aria-label="Selected"/);
  assert.match(html, />Web</);
  assert.match(html, />Android</);
});

test('uses the Astryx dropdown system for compact selects and searchable facet panels', async () => {
  const [source, componentSource, componentCss] = await Promise.all([
    readFile(new URL('./components/AppsFilterBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AstryxDropdown.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./components/AstryxDropdown.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((source.match(/<AstryxDropdown(?:\s|\n)/g) ?? []).length, 5);
  assert.match(source, /<DiscoveryPlatformFilterOptions/);
  assert.match(source, /<DiscoverySingleSelectOptions/);
  assert.match(source, /triggerVariant="primary"/);
  assert.match(source, /mode="panel"/);
  assert.match(source, /panelAriaLabel=\{`\$\{group\.label\} filters`\}/);
  assert.match(source, /<DiscoveryFilterSearch[\s\S]*label=\{group\.label\}/);
  assert.doesNotMatch(source, /searchLabel=/);
  assert.match(componentSource, /<DropdownMenu/);
  assert.match(componentSource, /export function AstryxMenu/);
  assert.match(componentSource, /\['astryx-dropdown',\s*props\.className\]/);
  assert.match(componentCss, /\.astryx-dropdown\s*\{[^}]*max-height:[^}]*padding:\s*6px\s*!important/);
  assert.match(componentCss, /\.astryx-dropdown__item--selected\s*\{/);
});

test('constrains long filter menus to the viewport and scrolls only their options', async () => {
  const [css, componentCss] = await Promise.all([
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
    readFile(new URL('./components/AstryxDropdown.css', import.meta.url), 'utf8'),
  ]);

  assert.match(
    componentCss,
    /\.astryx-dropdown-panel\s*\{[^}]*height:\s*min\(520px,\s*calc\(100dvh - 168px\)\)[^}]*overflow:\s*hidden/,
  );
  assert.match(
    css,
    /\.apps-filterbar__menu\s*\{[^}]*min-height:\s*0[^}]*height:\s*auto/,
  );
  assert.match(
    css,
    /\.apps-filterbar__options\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/,
  );
  assert.match(
    componentCss,
    /\.astryx-dropdown-panel\s*\{[^}]*width:\s*min\(288px,\s*calc\(100vw - 48px\)\)[^}]*animation:\s*astryx-dropdown-in 180ms/,
  );
  assert.match(componentCss, /@keyframes astryx-dropdown-in\s*\{/);
  assert.match(
    componentCss,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.astryx-dropdown-panel\s*\{[^}]*animation:\s*none/,
  );
});

test('keeps the shared filter panel themed when portalled from App Detail', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const sharedPanelRule = css.match(
    /\.astryx-dropdown-panel:has\(\.apps-filterbar__menu\)\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(sharedPanelRule, /--reference-chrome-surface-raised:\s*var\(--vitrine-color-surface\)/);
  assert.match(sharedPanelRule, /--reference-chrome-hover:\s*var\(--vitrine-color-surface-muted\)/);
  assert.match(sharedPanelRule, /--reference-chrome-border:\s*var\(--vitrine-color-border\)/);
  assert.match(sharedPanelRule, /--reference-chrome-text:\s*var\(--vitrine-color-text-primary\)/);
  assert.match(sharedPanelRule, /--reference-chrome-disabled:\s*var\(--vitrine-color-text-disabled\)/);
});

test('matches unselected Apps dropdown triggers to the App Detail control', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');
  const sharedTriggerRule = css.match(
    /\.discovery-filter-control:not\(\.apps-filterbar__filter--platform\):not\(\.apps-filterbar__filter--primary\):not\(\.apps-filterbar__filter--selected\) \.apps-filterbar__filter-button\.apps-filterbar__filter-button\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(sharedTriggerRule, /height:\s*var\(--vitrine-control-height\)\s*!important/);
  assert.match(sharedTriggerRule, /border:\s*1px solid var\(--vitrine-color-border-emphasized\)\s*!important/);
  assert.match(sharedTriggerRule, /color:\s*var\(--reference-chrome-text\)\s*!important/);
  assert.match(sharedTriggerRule, /font-weight:\s*600\s*!important/);
});

test('keeps selected Apps filters checked only in their grouped taxonomy with theme-aware controls', async () => {
  const [source, css, spacingCss] = await Promise.all([
    readFile(new URL('./components/AppsFilterBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
    readFile(new URL('./productSpacing.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(source, /apps-filterbar__selected-options/);
  assert.doesNotMatch(source, /apps-filterbar__option-divider/);
  assert.doesNotMatch(css, /\.apps-filterbar__selected-options\s*\{/);
  assert.match(
    source,
    /className="apps-filterbar__checkbox-option"[\s\S]*closest\('input, label'\)[\s\S]*onChange=\{onToggle\}/,
  );
  assert.match(source, /icon=\{<Icon icon="close" size="sm" \/>\}/);
  assert.match(
    css,
    /\.apps-filterbar__checkbox-option\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*cursor:\s*pointer;/,
  );
  assert.match(
    css,
    /\.apps-filterbar__checkbox-option input\[type='checkbox'\] \+ div\s*\{[^}]*border-color:\s*var\(--vitrine-color-border-emphasized\)\s*!important/,
  );
  assert.match(
    css,
    /\.apps-filterbar__checkbox-option input\[type='checkbox'\]:checked \+ div\s*\{[^}]*border-color:\s*var\(--color-accent\)\s*!important;[^}]*background:\s*var\(--color-accent\)\s*!important;[^}]*color:\s*var\(--color-on-accent\)\s*!important/,
  );
  assert.match(
    css,
    /\.apps-filterbar__filter--selected\s*\{[^}]*border-color:\s*var\(--reference-chrome-text\);[^}]*box-shadow:\s*inset 0 0 0 1px var\(--reference-chrome-text\);/,
  );
  assert.match(
    css,
    /\.discovery-filter-control \.apps-filterbar__filter-button[\s\S]*?border:\s*0\s*!important;[^}]*box-shadow:\s*none\s*!important;/,
  );
  assert.match(
    css,
    /\.apps-filterbar__filter-button\s*\{[^}]*height:\s*34px\s*!important;[^}]*min-height:\s*34px\s*!important;/,
  );
  assert.match(
    css,
    /\.apps-filterbar__clear\.astryx-button\s*\{[^}]*width:\s*26px\s*!important;[^}]*height:\s*26px\s*!important;[^}]*min-height:\s*26px\s*!important;/,
  );
  assert.match(
    spacingCss,
    /\.discovery-filter-control\.discovery-filter-control \.apps-filterbar__clear\.apps-filterbar__clear\s*\{[^}]*width:\s*calc\(var\(--vitrine-control-height\) - var\(--spacing-2\)\)\s*!important;/,
  );
  assert.doesNotMatch(spacingCss, /color-gallery__collection-picker/);
});

test('closes an Apps filter menu only for interactions outside its active container', () => {
  const inside = {} as Node;
  const outside = {} as Node;
  const container = {
    contains: (target: Node | null) => target === inside,
  };

  assert.equal(isOutsideDiscoveryFilterMenu(container, inside), false);
  assert.equal(isOutsideDiscoveryFilterMenu(container, outside), true);
  assert.equal(isOutsideDiscoveryFilterMenu(null, outside), false);
});

test('keeps clicks inside the portalled Astryx dropdown from dismissing before selection', () => {
  const insidePortal = {
    closest: (selector: string) => selector === '.astryx-dropdown' ? {} : null,
  } as unknown as EventTarget;
  const outsidePortal = {
    closest: () => null,
  } as unknown as EventTarget;

  assert.equal(isInsideAstryxDropdownPortal(insidePortal), true);
  assert.equal(isInsideAstryxDropdownPortal(outsidePortal), false);
  assert.equal(isInsideAstryxDropdownPortal(null), false);
});

test('keeps filter IDs distinct from reserved platform and sort menus', () => {
  const platform = { type: 'platform' } as const;
  const sort = { type: 'sort' } as const;
  const platformFilter = { type: 'filter', id: 'platform' } as const;
  const sortFilter = { type: 'filter', id: 'sort' } as const;

  assert.deepEqual(toggleDiscoveryMenu(platform, platformFilter), platformFilter);
  assert.deepEqual(toggleDiscoveryMenu(sort, sortFilter), sortFilter);
  assert.equal(toggleDiscoveryMenu(platformFilter, platformFilter), null);
});

test('closes an open discovery menu through Escape and outside pointer callbacks', () => {
  let closed = 0;
  const inside = {} as Node;
  const outside = {} as Node;
  const container = { contains: (target: Node | null) => target === inside };

  assert.equal(closeDiscoveryMenuForKey({ key: 'Enter' }, () => { closed += 1; }), false);
  assert.equal(closeDiscoveryMenuForKey({ key: 'Escape' }, () => { closed += 1; }), true);
  assert.equal(closeDiscoveryMenuForPointerDown(container, inside, () => { closed += 1; }), false);
  assert.equal(closeDiscoveryMenuForPointerDown(container, outside, () => { closed += 1; }), true);
  assert.equal(closed, 2);
});
