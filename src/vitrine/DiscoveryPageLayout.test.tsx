import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRef, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscoveryFilterBar } from './components/AppsFilterBar.tsx';
import { DiscoveryPageLayout } from './components/DiscoveryPageLayout.tsx';

function renderLayout(overrides: Partial<ComponentProps<typeof DiscoveryPageLayout>> = {}) {
  const { children = <article data-layout-part="result">Result</article>, ...props } = overrides;

  return renderToStaticMarkup(
    <DiscoveryPageLayout
      kind="sites"
      header={<header data-layout-part="header">Header</header>}
      taxonomyLabel="Site discovery filters"
      taxonomy={<nav data-layout-part="taxonomy">Taxonomy</nav>}
      toolbar={<div data-layout-part="toolbar">Toolbar</div>}
      resultLabel="sites"
      singularResultLabel="site"
      totalCount={1}
      renderedCount={1}
      loading={false}
      error={null}
      loadMoreError={null}
      onRetry={() => undefined}
      onRetryLoadMore={() => undefined}
      sentinelRef={createRef<HTMLDivElement>()}
      {...props}
    >
      {children}
    </DiscoveryPageLayout>,
  );
}

test('composes discovery content in the stable header, taxonomy, toolbar, meta, result, sentinel order', () => {
  const html = renderLayout();
  const ordered = [
    'data-layout-part="header"',
    'data-layout-part="taxonomy"',
    'data-layout-part="toolbar"',
    'reference-discovery__result-meta',
    'data-layout-part="result"',
    'discovery-page-layout__sentinel',
  ];
  const offsets = ordered.map((part) => html.indexOf(part));

  assert.ok(offsets.every((offset) => offset >= 0), `Missing layout marker: ${ordered.join(', ')}`);
  assert.deepEqual([...offsets].sort((a, b) => a - b), offsets);
  assert.match(html, /data-reference-gallery-shell="sites"/);
  assert.match(html, /class="[^"]*reference-discovery--sites[^"]*sites-discovery/);
  assert.match(html, /data-discovery-page-layout="sites"/);
  assert.match(html, /1 site/);
  assert.equal((html.match(/1 site/g) ?? []).length, 1);
});

test('omits the taxonomy region when a discovery page has no taxonomy content', () => {
  const html = renderLayout({
    kind: 'colors',
    taxonomy: null,
    taxonomyLabel: undefined,
  });

  assert.doesNotMatch(html, /reference-discovery__taxonomy/);
  assert.match(html, /data-layout-part="toolbar"/);
  assert.match(html, /data-discovery-page-layout="colors"/);
});

test('right-aligns the shared result count for Apps, Sites, and Flows', async () => {
  const css = await readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.reference-discovery__result-meta\s*\{[^}]*text-align:\s*right/,
  );
});

test('renders a compact progress treatment while loading another page', async () => {
  const [html, css] = await Promise.all([
    Promise.resolve(renderLayout({ loadingMore: true })),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /aria-label="Loading more sites"/);
  assert.match(html, /data-vitrine-spinner="comet"/);
  assert.match(html, /width="20"/);
  assert.doesNotMatch(html, /Loading more sites…/);
  assert.match(css, /\.discovery-page-layout__loading-more\s*\{[^}]*justify-content:\s*center/);
});

test('keeps kind-specific shell classes and data attributes for every discovery kind', () => {
  for (const kind of ['apps', 'sites', 'flows', 'colors'] as const) {
    const html = renderLayout({ kind });

    assert.match(html, new RegExp(`data-reference-gallery-shell="${kind}"`));
    assert.match(html, new RegExp(`reference-discovery--${kind}`));
    assert.match(html, new RegExp(`data-${kind}-discovery="true"`));
    assert.match(html, new RegExp(`data-discovery-page-layout="${kind}"`));
  }
});

test('uses explicit renderedCount for initial loading, error, and empty state precedence', () => {
  const loading = renderLayout({ loading: true, renderedCount: 0, children: <></> });
  const error = renderLayout({ error: 'Network failed' });
  const empty = renderLayout({
    totalCount: 0,
    renderedCount: 0,
    onReset: () => undefined,
    children: <></>,
  });

  assert.match(loading, /role="status"[^>]*aria-label="Loading sites"/);
  assert.equal((loading.match(/data-app-card-skeleton="true"/g) ?? []).length, 3);
  assert.match(error, /role="alert"/);
  assert.match(error, /Could not load sites/);
  assert.match(error, /Network failed/);
  assert.match(error, />Retry</);
  assert.doesNotMatch(error, /data-layout-part="result"/);
  assert.match(empty, /role="status"/);
  assert.match(empty, /No sites found/);
  assert.match(empty, />Clear filters</);
});

test('uses a flow-shaped loading footprint for the Flows catalog', () => {
  const loading = renderLayout({
    kind: 'flows',
    resultLabel: 'flows',
    singularResultLabel: 'flow',
    loading: true,
    renderedCount: 0,
    children: <></>,
  });

  assert.match(loading, /aria-label="Loading flows"/);
  assert.equal((loading.match(/discovery-page-layout__flow-skeleton"/g) ?? []).length, 2);
  assert.doesNotMatch(loading, /data-app-card-skeleton="true"/);
});

test('keeps loaded children when loading more fails and places the sentinel last', () => {
  const html = renderLayout({ loadMoreError: 'Timed out' });
  const result = html.indexOf('data-layout-part="result"');
  const loadMoreError = html.indexOf('discovery-page-layout__load-more-error');
  const sentinel = html.indexOf('discovery-page-layout__sentinel');

  assert.ok(result >= 0);
  assert.ok(loadMoreError > result);
  assert.ok(sentinel > loadMoreError);
  assert.match(html, /Could not load more sites: Timed out/);
  assert.match(html, /data-discovery-sentinel="sites"/);
  assert.match(html, /data-discovery-sentinel="sites"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /aria-label="Load more sites"/);
});

test('uses a persistent catalog banner with an explicit account action at the guest limit', async () => {
  const [html, source, css] = await Promise.all([
    Promise.resolve(renderLayout({
      guestLimitReached: true,
      onGuestLimitReached: () => undefined,
    })),
    readFile(new URL('./components/DiscoveryPageLayout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /data-guest-catalog-limit="true"/);
  assert.match(html, /role="region"/);
  assert.match(html, /Keep exploring with a free account/);
  assert.match(html, /Create free account/);
  assert.doesNotMatch(source, /IntersectionObserver/);
  assert.match(css, /\.discovery-page-layout__guest-limit\s*\{[^}]*justify-content:\s*space-between/);
});

test('uses renderedCount rather than empty children to preserve inline load-more errors', () => {
  const html = renderLayout({
    renderedCount: 1,
    loadMoreError: 'Timed out',
    children: <></>,
  });

  assert.match(html, /Could not load more sites: Timed out/);
  assert.doesNotMatch(html, /No sites found/);
});

test('owns one result count when the shared filter toolbar is composed into the layout', () => {
  const html = renderLayout({
    toolbar: (
      <DiscoveryFilterBar
        kind="sites"
        ariaLabel="Site discovery controls"
        platform={{ value: 'web', ariaLabel: 'Site platform', onChange: () => undefined }}
        filters={[]}
        resultCount={1}
        resultLabels={['site', 'sites']}
        sort="latest"
        sortOptions={[{ value: 'latest', label: 'Latest' }]}
        onSortChange={() => undefined}
        onToggleFilter={() => undefined}
        onClearFilter={() => undefined}
      />
    ),
  });

  assert.equal((html.match(/1 site/g) ?? []).length, 1);
  assert.doesNotMatch(html, /apps-filterbar__count/);
});
