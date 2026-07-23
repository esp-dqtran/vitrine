import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

test('renders the shared gallery section, toolbar, grid, and sentinel slots', async () => {
  assert.equal(existsSync('src/vitrine/components/ReferenceGallerySection.tsx'), true);
  const { ReferenceGalleryGrid, ReferenceGallerySection } = await import('./components/ReferenceGallerySection.tsx');
  const html = renderToStaticMarkup(
    <ReferenceGallerySection toolbar={<button>Filter</button>} sentinel={<div>More</div>}>
      <ReferenceGalleryGrid minCardWidth={220}><article>Card</article></ReferenceGalleryGrid>
    </ReferenceGallerySection>,
  );
  assert.match(html, /data-reference-gallery="section"/);
  assert.match(html, /data-reference-gallery="toolbar"/);
  assert.match(html, /data-reference-gallery="grid"/);
  assert.match(html, /minmax\(220px,1fr\)/);
  assert.match(html, /data-reference-gallery="sentinel"/);
});
