import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lightbox } from './components/Lightbox.tsx';

test('does not emit a native protected-media request from the lightbox', () => {
  const html = renderToStaticMarkup(
    <Lightbox
      item={{
        kind: 'image',
        url: '/api/media/aboard/0123456789abcdef',
        type: 'Screen',
        caption: 'Welcome screen',
      }}
      index={0}
      total={1}
      onClose={() => undefined}
      onNavigate={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /src="\/api\/media\//);
  assert.doesNotMatch(html, /Captured preview unavailable/);
  assert.match(html, /Welcome screen/);
});
