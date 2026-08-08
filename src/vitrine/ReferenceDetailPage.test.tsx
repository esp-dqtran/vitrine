import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceDetailPage } from './components/ReferenceDetailPage.tsx';

const detailProps = {
  title: 'Reference',
  identityKey: 'reference-1',
  identityLabel: 'R',
  identityImageUrl: '/assets/icons/reference.webp',
  metadata: [{ label: 'Pages', value: '12' }],
  tabs: [{ id: 'preview' as const, label: 'Preview' }],
  activeTab: 'preview' as const,
  onTabChange: () => undefined,
};

test('composes an App detail navigation and shell as one generic page', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailPage
      {...detailProps}
      kind="app"
      searchLabel="Search on Web..."
      accountControls={<button type="button">Account</button>}
    >
      App body
    </ReferenceDetailPage>,
  );

  assert.match(html, /class="reference-discovery-nav reference-detail-top-nav"/);
  assert.match(html, /data-reference-detail="app"/);
  assert.match(html, /Search on Web\.\.\./);
  assert.match(html, /Account/);
  assert.match(html, /App body/);
  assert.match(html, /src="\/favicon\.svg"/);
  assert.match(html, /reference-discovery-nav__identity/);
  assert.match(html, /src="\/assets\/icons\/reference\.webp"/);
});

test('composes a Site detail navigation and shell from the same page component', () => {
  const html = renderToStaticMarkup(
    <ReferenceDetailPage
      {...detailProps}
      kind="site"
      searchLabel="Search sites"
    >
      Site body
    </ReferenceDetailPage>,
  );

  assert.match(html, /class="reference-discovery-nav reference-detail-top-nav"/);
  assert.match(html, /data-reference-detail="site"/);
  assert.match(html, /Search sites/);
  assert.match(html, /Site body/);
  assert.match(
    readFileSync(new URL('./components/ReferenceDetailPage.tsx', import.meta.url), 'utf8'),
    /contextIconUrl=\{detailProps\.identityImageUrl\}/,
  );
});
