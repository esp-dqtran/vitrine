import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AstryxAlertModal,
  AstryxModal,
  AstryxModalSurface,
} from './components/AstryxModal.tsx';

test('applies the shared modal contract to standard dialogs', () => {
  const html = renderToStaticMarkup(
    <AstryxModal
      isOpen
      isInline
      onOpenChange={() => undefined}
      purpose="info"
    >
      Modal content
    </AstryxModal>,
  );

  assert.match(html, /class="[^"]*astryx-modal astryx-modal--dialog/);
  assert.match(html, />Modal content</);
});

test('applies the fullscreen presentation and shared surface', () => {
  const html = renderToStaticMarkup(
    <AstryxModal
      isOpen
      isInline
      onOpenChange={() => undefined}
      variant="fullscreen"
    >
      <AstryxModalSurface data-example-modal="true">
        Preview
      </AstryxModalSurface>
    </AstryxModal>,
  );

  assert.match(html, /astryx-modal--fullscreen/);
  assert.match(html, /class="astryx-modal__surface"/);
  assert.match(html, /data-example-modal="true"/);
});

test('applies the shared contract to confirmation dialogs', () => {
  const html = renderToStaticMarkup(
    <AstryxAlertModal
      isOpen
      isInline
      onOpenChange={() => undefined}
      title="Delete item?"
      description="This cannot be undone."
      actionLabel="Delete"
      onAction={() => undefined}
    />,
  );

  assert.match(html, /astryx-modal--alert/);
  assert.match(html, />Delete item\?</);
});

test('keeps edge drawers inside the shared modal system', () => {
  const html = renderToStaticMarkup(
    <AstryxModal
      isOpen
      isInline
      onOpenChange={() => undefined}
      presentation="drawer-left"
    >
      Drawer content
    </AstryxModal>,
  );

  assert.match(html, /astryx-modal--drawer-left/);
});

test('enforces Escape and backdrop dismissal for every shared modal', async () => {
  const source = await readFile(
    new URL('./components/AstryxModal.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /purpose=\{purpose\}/);
  assert.match(source, /event\.target === dialog/);
  assert.match(source, /onOpenChange\(false\)/);
  assert.match(source, /dialog\.addEventListener\('click', closeFromBackdrop\)/);
});

test('preserves scrolling for the fullscreen advanced-search preview', async () => {
  const [modalCss, preview] = await Promise.all([
    readFile(new URL('./components/AstryxModal.css', import.meta.url), 'utf8'),
    readFile(new URL('./components/AdvancedSearchPreview.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(preview, /className="advanced-search-preview__panel"/);
  assert.match(
    modalCss,
    /\.astryx-modal__surface\.advanced-search-preview__panel\s*\{\s*overflow-y:\s*auto;/,
  );
});
