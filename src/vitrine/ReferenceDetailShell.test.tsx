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
      tabControls={<button>Filter screens</button>}
      tabTrailing={<span>Showing 16 pages</span>}
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
  assert.match(html, /reference-detail__navigation[\s\S]*reference-detail__tab-controls[^>]*><button>Filter screens<\/button>/);
  assert.match(html, /reference-detail__tab-controls[\s\S]*reference-detail__tab-trailing[^>]*><span>Showing 16 pages<\/span>/);
  assert.match(html, /<div style="min-height:400px">/);
  assert.doesNotMatch(html, /background:[^;"]+;min-height:400px/);
});

test('renders real identity media on mobile with a letter fallback', async () => {
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
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const fallbackRule = styles.match(
    /\.reference-detail__logo-fallback\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const imageLogoRule = styles.match(
    /\.reference-detail__logo--image\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const pictureRule = styles.match(
    /\.reference-detail__logo-picture\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const imageFallbackRule = styles.match(
    /\.reference-detail__logo--image \.reference-detail__logo-fallback\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const darkImageLogoRule = styles.match(
    /\.reference-detail__logo--image-dark\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const darkImageFallbackRule = styles.match(
    /\.reference-detail__logo--image-dark \.reference-detail__logo-fallback\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(html, /<img[^>]+src="\/quora\.png"[^>]+loading="eager"/);
  assert.doesNotMatch(html, /<source[^>]+media="\(min-width: 601px\)"/);
  assert.match(html, /reference-detail__logo-fallback[^>]*>Q<\/span>/);
  assert.match(html, /reference-detail__logo--image-light/);
  assert.doesNotMatch(html, /reference-detail__logo[^>]+style=/);
  assert.match(fallbackRule, /display:\s*grid/);
  assert.match(imageLogoRule, /border:\s*1px solid var\(--color-border-subtle\)/);
  assert.match(imageLogoRule, /background:\s*#fff/);
  assert.match(pictureRule, /width:\s*64%/);
  assert.match(pictureRule, /height:\s*64%/);
  assert.match(imageFallbackRule, /background:\s*#fff/);
  assert.match(imageFallbackRule, /opacity:\s*0/);
  assert.match(darkImageLogoRule, /background:\s*#000/);
  assert.match(darkImageFallbackRule, /background:\s*#000/);
  assert.match(darkImageFallbackRule, /color:\s*#fff/);
  assert.match(
    styles,
    /\.reference-detail__logo--image-failed \.reference-detail__logo-picture\s*\{[^}]*display:\s*none/,
  );
  assert.match(
    styles,
    /\.reference-detail__logo--image-failed \.reference-detail__logo-fallback\s*\{[^}]*opacity:\s*1/,
  );
  assert.match(html, /fetchPriority="high"/);
  assert.match(html, /width="88"/);
  assert.match(html, /height="88"/);
});

test('renders a white identity mark on a black plate when requested', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailShell
      title="Mobbin"
      identityKey="site-icon-mobbin"
      identityLabel="M"
      identityImageUrl="/mobbin.svg"
      identityImageTone="dark"
      metadata={[]}
      tabs={[{ id: 'preview', label: 'Preview' }]}
      activeTab="preview"
      onTabChange={() => undefined}
    >Preview</ReferenceDetailShell>,
  );

  assert.match(
    html,
    /reference-detail__logo--image reference-detail__logo--image-dark/,
  );
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

test('shares the compact Apps detail presentation with Sites', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const heroRule = styles.match(
    /\.reference-detail__hero-inner\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const logoRule = styles.match(
    /\.reference-detail__logo\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const headingRule = styles.match(
    /\.reference-detail__heading h1\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const descriptionRule = styles.match(
    /\.reference-detail__heading p\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const metadataRule = styles.match(
    /\.reference-detail__metadata\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const actionsRule = styles.match(
    /\.reference-detail__actions\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const navigationRule = styles.match(
    /\.reference-detail__navigation\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabsRule = styles.match(
    /\.reference-detail__tabs\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const tabRule = styles.match(
    /\.reference-detail__tabs > button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const activeRule = styles.match(
    /\.reference-detail__tabs > button:hover,[\s\S]*?\.reference-detail__tabs > button\[aria-selected='true'\]\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const indicatorRule = styles.match(
    /\.reference-detail__tab-indicator\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(heroRule, /grid-template-columns:\s*80px minmax\(0,\s*1fr\) auto/);
  assert.match(heroRule, /grid-template-areas:[\s\S]*"logo heading actions"[\s\S]*"logo metadata actions"/);
  assert.match(heroRule, /column-gap:\s*24px/);
  assert.match(heroRule, /padding-bottom:\s*28px/);

  assert.match(logoRule, /width:\s*80px/);
  assert.match(logoRule, /height:\s*80px/);
  assert.match(logoRule, /border-radius:\s*20px/);

  assert.match(headingRule, /font-size:\s*clamp\(32px,\s*3vw,\s*38px\)/);
  assert.match(descriptionRule, /color:\s*var\(--color-text-secondary\)/);
  assert.match(descriptionRule, /font-size:\s*clamp\(18px,\s*1\.7vw,\s*24px\)/);

  assert.match(metadataRule, /gap:\s*32px/);
  assert.match(metadataRule, /padding-top:\s*0/);
  assert.match(actionsRule, /grid-area:\s*actions/);
  assert.match(actionsRule, /padding:\s*0/);

  assert.match(navigationRule, /min-height:\s*64px/);
  assert.match(navigationRule, /border-top:\s*1px solid var\(--color-border-subtle\)/);
  assert.match(tabsRule, /gap:\s*24px/);
  assert.match(tabsRule, /justify-content:\s*flex-start/);
  assert.match(tabsRule, /flex:\s*0 1 auto/);
  assert.match(tabsRule, /overflow-x:\s*auto/);
  assert.match(tabsRule, /scroll-snap-type:\s*inline proximity/);
  assert.match(tabRule, /min-width:\s*max-content/);
  assert.match(tabRule, /min-height:\s*64px/);
  assert.match(tabRule, /height:\s*56px/);
  assert.match(tabRule, /font-size:\s*16px/);
  assert.match(activeRule, /background:\s*transparent/);
  assert.match(activeRule, /color:\s*var\(--color-text-primary\)/);
  assert.match(indicatorRule, /bottom:\s*0/);
  assert.match(indicatorRule, /height:\s*2px/);
  assert.match(indicatorRule, /border-radius:\s*999px/);
});

test('shares metadata and action scale without leaking App controls into Sites', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const metadataLabelRule = styles.match(
    /\.reference-detail__metadata-item > span\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const metadataValueRule = styles.match(
    /\.reference-detail__metadata-item > strong\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const actionRule = styles.match(
    /\.reference-detail__actions button\s*\{[^}]+\}/,
  )?.[0] ?? '';
  const leadingRule = styles.match(
    /\.reference-detail__tab-leading\s*\{[^}]+\}/,
  )?.[0] ?? '';

  assert.match(metadataLabelRule, /font-size:\s*16px/);
  assert.match(metadataValueRule, /font-size:\s*17px/);
  assert.match(actionRule, /min-height:\s*44px/);
  assert.match(actionRule, /font-size:\s*16px/);
  assert.match(leadingRule, /padding-bottom:\s*0/);

  assert.match(
    styles,
    /\.reference-detail\[data-reference-detail='app'\] \.reference-detail__metadata-item \.apps-platform-switcher/,
  );
  assert.doesNotMatch(
    styles,
    /\.reference-detail\[data-reference-detail='site'\][^{]*\.apps-platform-switcher/,
  );
});

test('stacks the shared compact detail shell at the mobile breakpoint', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const keyframesStart = styles.indexOf('@keyframes vtDraw');
  const mobileStart = styles.lastIndexOf('@media (max-width: 760px)', keyframesStart);
  assert.notEqual(mobileStart, -1);
  assert.notEqual(keyframesStart, -1);
  const mobile = styles.slice(mobileStart, keyframesStart);

  assert.match(
    mobile,
    /(?:^|\n)\s{2}\.reference-detail__hero-inner\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/,
  );
  assert.match(
    mobile,
    /(?:^|\n)\s{2}\.reference-detail__metadata\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    mobile,
    /(?:^|\n)\s{2}\.reference-detail__actions\s*\{[^}]*width:\s*100%/,
  );
});

test('centers shared detail loading while preserving Site failure gutters', async () => {
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  const loadingRule = styles.match(/\.reference-detail-loading\s*\{[^}]+\}/)?.[0] ?? '';
  const failureRule = styles.match(/\.site-detail--failure\s*\{[^}]+\}/)?.[0] ?? '';
  const keyframesStart = styles.indexOf('@keyframes vtDraw');
  const mobileStart = styles.lastIndexOf('@media (max-width: 760px)', keyframesStart);
  assert.notEqual(mobileStart, -1);
  assert.notEqual(keyframesStart, -1);
  const mobile = styles.slice(mobileStart, keyframesStart);

  assert.match(loadingRule, /min-height:\s*calc\(100vh - var\(--reference-nav-height,\s*72px\)\)/);
  assert.match(loadingRule, /place-content:\s*center/);
  assert.match(failureRule, /width:\s*100%/);
  assert.match(failureRule, /padding:\s*24px 32px 80px/);
  assert.match(
    mobile,
    /\.site-detail--failure\s*\{[^}]*padding:\s*24px 16px 80px/,
  );
});
