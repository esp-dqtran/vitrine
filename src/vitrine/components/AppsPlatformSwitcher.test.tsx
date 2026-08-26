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
  assert.match(html, /data-platform-icon="web"/);
  assert.match(html, /data-platform-icon="ios"/);
  assert.doesNotMatch(html, /data-platform-icon="android"/);
  const buttonMarkup = (html.match(/<button[\s\S]*?<\/button>/g) ?? []).join('');
  assert.match(buttonMarkup, /apps-platform-switcher__label">Web</);
  assert.match(buttonMarkup, /apps-platform-switcher__label">iOS</);
  assert.match(html, /role="radio"[^>]*aria-checked="true"[^>]*aria-label="Web"/);
  assert.match(html, /aria-label="iOS"/);
  assert.ok(html.indexOf('data-platform-icon="web"') < html.indexOf('data-platform-icon="ios"'));
});
