import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteSectionInspector, type SiteInspectorItem } from './components/SiteSectionInspector.tsx';

const item: SiteInspectorItem = {
  id: 12,
  kind: 'image',
  sectionUrl: '/api/sites/1/versions/2/sections/12/media',
  fullPageUrl: '/api/sites/1/versions/2/pages/10/media',
  pageTitle: 'Home',
  pageUrl: 'https://v7labs.com/',
  patterns: ['Hero Section'],
  caption: 'Home · Section 1',
  metadata: {
    heading: 'Build intelligent products',
    selector: 'main > section',
    tagName: 'section',
    text: 'Build intelligent products with production-ready AI.',
    style: { display: 'grid', gap: '24px' },
    content: { links: 2, buttons: 1, images: 3, videos: 0, forms: 0 },
  },
};

test('renders the focused Site section with context controls', () => {
  const html = renderToStaticMarkup(
    <SiteSectionInspector
      item={item}
      index={0}
      total={2}
      view="section"
      onViewChange={() => undefined}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /Section/);
  assert.match(html, /Full page/);
  assert.doesNotMatch(html, /Hero Section/);
  assert.match(html, /sections\/12\/media/);
  assert.match(html, /1 of 2/);
  assert.match(html, /Build intelligent products/);
  assert.match(html, /site-section-inspector__header/);
  assert.match(html, /class="[^"]*astryx-modal--fullscreen[^"]*flow-preview-dialog-shell[^"]*site-section-inspector-shell/);
  assert.match(html, /class="astryx-modal__surface flow-preview-dialog site-section-inspector"/);
  assert.match(html, /object-fit:contain;background:transparent/);
  assert.doesNotMatch(html, /Reconstruction details/);
  assert.doesNotMatch(html, /main &gt; section/);
  assert.doesNotMatch(html, /2 links · 1 button · 3 images/);
  assert.doesNotMatch(html, /Home · v7labs\.com/);
  const saveButton = html.match(/<button[^>]*flow-preview-dialog__save[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  const copyButton = html.match(/<button[^>]*flow-preview-dialog__copy[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(saveButton, /data-variant="primary"/);
  assert.match(saveButton, />Save</);
  assert.match(copyButton, /data-variant="secondary"/);
  assert.match(copyButton, />Copy link</);
  assert.match(html, />Copy link</);
  assert.doesNotMatch(html, /Download/);
  assert.doesNotMatch(html, />Saved</);
});

test('renders parent full-page media when Full page is selected', () => {
  const html = renderToStaticMarkup(
    <SiteSectionInspector
      item={item}
      index={0}
      total={2}
      view="full-page"
      onViewChange={() => undefined}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );
  assert.match(html, /pages\/10\/media/);
  assert.doesNotMatch(html, /<video/);
});

test('renders section video controls but keeps Full page as an image', () => {
  const videoItem: SiteInspectorItem = {
    ...item,
    id: 13,
    kind: 'video',
    sectionUrl: '/api/sites/1/versions/2/sections/13/media',
    posterUrl: '/api/sites/1/versions/2/sections/13/poster',
  };
  const sectionHtml = renderToStaticMarkup(
    <SiteSectionInspector item={videoItem} index={1} total={2} view="section" onViewChange={() => undefined} onClose={() => undefined} onNavigate={() => undefined} />,
  );
  const pageHtml = renderToStaticMarkup(
    <SiteSectionInspector item={videoItem} index={1} total={2} view="full-page" onViewChange={() => undefined} onClose={() => undefined} onNavigate={() => undefined} />,
  );
  assert.match(sectionHtml, /<video/);
  assert.match(sectionHtml, /controls=""/);
  assert.match(sectionHtml, /sections\/13\/poster/);
  assert.doesNotMatch(pageHtml, /<video/);
  assert.match(pageHtml, /pages\/10\/media/);
});
