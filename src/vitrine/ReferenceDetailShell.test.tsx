import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ReferenceDetailShell,
  resetReferenceDetailScroll,
} from './components/ReferenceDetailShell.tsx';

test('resets shared detail pages to the top when their identity changes', () => {
  let received: ScrollToOptions | undefined;
  resetReferenceDetailScroll((options) => { received = options; });
  assert.deepEqual(received, { top: 0, left: 0, behavior: 'auto' });
});

test('renders the Apps-style hero, actions, metadata, and accessible tabs', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailShell
      title="V7"
      description="AI-powered visual data platform."
      className="site-detail"
      dataDetailKind="site"
      identityKey="site-icon-1"
      identityLabel="V"
      backLabel="Back to all sites"
      onBack={() => undefined}
      metadata={[{ label: 'Version', value: 'Jul 2026' }, { label: 'Pages', value: '16' }]}
      actions={<button>Visit site</button>}
      tabLeading={<button>Latest</button>}
      tabs={[{ id: 'overview', label: 'Overview' }, { id: 'pages', label: 'Pages', count: 16 }]}
      activeTab="overview"
      onTabChange={() => undefined}
    >Overview content</ReferenceDetailShell>,
  );
  assert.match(html, /Back to all sites/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"[^>]+aria-selected="true"/);
  assert.match(html, /Visit site/);
  assert.match(html, /Overview content/);
  assert.match(html, /data-reference-detail="site"/);
  assert.match(html, /class="vitrine-page reference-detail site-detail"/);
  assert.match(html, /AI-powered visual data platform\./);
  assert.match(html, /reference-detail__tab-leading[^>]*><button>Latest<\/button>/);
  assert.match(html, /<div style="min-height:400px">/);
  assert.doesNotMatch(html, /background:[^;"]+;min-height:400px/);
});

test('keeps remote identity media off the mobile critical path', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailShell
      title="Quora"
      identityKey="app-icon-quora"
      identityLabel="Q"
      identityImageUrl="/quora.png"
      metadata={[]}
      tabs={[{ id: 'overview', label: 'Overview' }]}
      activeTab="overview"
      onTabChange={() => undefined}
    >Overview</ReferenceDetailShell>,
  );

  assert.match(html, /<source[^>]+media="\(min-width: 601px\)"[^>]+srcSet="\/quora\.png"/);
  assert.match(html, /<img[^>]+loading="eager"/);
  assert.doesNotMatch(html, /<img[^>]+src="\/quora\.png"/);
  assert.match(html, /reference-detail__logo-fallback[^>]*>Q<\/span>/);
  assert.match(html, /fetchPriority="high"/);
  assert.match(html, /width="88"/);
  assert.match(html, /height="88"/);
});

test('renders Vitrine primary actions as white buttons with black content', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const primaryActionRule = styles.match(
    /button\[data-variant='primary'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(primaryActionRule, /border-color:\s*#fff\s*!important/);
  assert.match(primaryActionRule, /background:\s*#fff\s*!important/);
  assert.match(primaryActionRule, /color:\s*#111\s*!important/);
  assert.match(
    styles,
    /button\[data-variant='primary'\]:hover:not\(:disabled\)\s*\{[^}]*background:\s*#f1f1f1\s*!important/,
  );
  assert.match(
    styles,
    /button\[data-variant='primary'\]:active:not\(:disabled\)\s*\{[^}]*background:\s*#e5e5e5\s*!important/,
  );
  assert.doesNotMatch(
    styles,
    /\.reference-detail\[data-reference-detail='app'\] button\[data-variant='primary'\]/,
  );
});

test('copies the Apps ordering strip style onto App detail tabs only', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const tabsRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const activeRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button:hover,[\s\S]*?\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tabs > button\[aria-selected='true'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const indicatorRule = styles.match(
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__tab-indicator\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(tabsRule, /align-self:\s*stretch/);
  assert.match(tabsRule, /gap:\s*25px/);
  assert.match(tabsRule, /overflow-x:\s*auto/);

  assert.match(tabRule, /min-width:\s*max-content/);
  assert.match(tabRule, /height:\s*64px/);
  assert.match(tabRule, /color:\s*var\(--color-text-secondary\)/);
  assert.match(tabRule, /font-size:\s*14px/);
  assert.match(tabRule, /transition:\s*color 180ms ease/);

  assert.match(activeRule, /background:\s*transparent/);
  assert.match(activeRule, /color:\s*var\(--color-text-primary\)/);

  assert.match(indicatorRule, /bottom:\s*13px/);
  assert.match(indicatorRule, /height:\s*2px/);
  assert.match(indicatorRule, /border-radius:\s*999px/);

  assert.doesNotMatch(styles, /\.reference-detail\[data-reference-detail='site'\] \.reference-detail__tabs > button/);
});
