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
  assert.match(html, /Hero Section/);
  assert.match(html, /https:\/\/v7labs\.com\//);
  assert.match(html, /sections\/12\/media/);
  assert.match(html, /1 of 2/);
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
