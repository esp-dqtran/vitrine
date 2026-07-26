import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppsPlatformSwitcher } from './AppsPlatformSwitcher.tsx';

test('renders only supported platforms in Apps order with radio state', () => {
  const html = renderToStaticMarkup(
    <AppsPlatformSwitcher
      value="web"
      platforms={['ios', 'web']}
      onChange={() => undefined}
    />,
  );

  assert.match(html, /role="radiogroup"/);
  assert.match(html, />Web</);
  assert.match(html, />iOS</);
  assert.doesNotMatch(html, />Android</);
  assert.match(html, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="Web"/);
  assert.ok(html.indexOf('>Web<') < html.indexOf('>iOS<'));
});
