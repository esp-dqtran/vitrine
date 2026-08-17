import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegalPage } from './LegalPages.tsx';

const props = { onBrowse: () => undefined, onSignIn: () => undefined };

test('renders the three Paddle-ready policy documents with links between them', () => {
  const terms = renderToStaticMarkup(<LegalPage page="terms" {...props} />);
  const privacy = renderToStaticMarkup(<LegalPage page="privacy" {...props} />);
  const refunds = renderToStaticMarkup(<LegalPage page="refunds" {...props} />);

  assert.match(terms, /Terms of Service/);
  assert.match(terms, /Paddle acts as merchant of record/);
  assert.match(privacy, /Privacy Policy/);
  assert.match(privacy, /Payment-card details are processed by Paddle/);
  assert.match(refunds, /Refund Policy/);
  assert.match(refunds, /14 calendar days/);
  for (const html of [terms, privacy, refunds]) {
    assert.match(html, /href="\/terms"/);
    assert.match(html, /href="\/privacy"/);
    assert.match(html, /href="\/refunds"/);
  }
});
