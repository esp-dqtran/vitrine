import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  catalogAppIcons,
  DiscoverySignupReveal,
} from './components/DiscoverySignupReveal.tsx';
import type { App } from './types.ts';

const app = (id: string, name: string, iconUrl: string | null): App => ({
  id,
  app: name,
  categories: [],
  accent: '#111111',
  totalScreens: 0,
  iconUrl,
  screens: [],
});

test('builds unique AppIcon carousel items with fallback-ready app metadata', () => {
  const icons = catalogAppIcons([
    app('linear', 'Linear', '/linear.webp'),
    app('notion', 'Notion', null),
    app('linear', 'Linear duplicate', '/duplicate.webp'),
  ]);

  assert.deepEqual(icons, [
    { id: 'linear', name: 'Linear', iconUrl: '/linear.webp', accent: '#111111' },
    { id: 'notion', name: 'Notion', iconUrl: null, accent: '#111111' },
  ]);
});

test('mounts the source FooterEasterEgg without its dotted background layer', async () => {
  const [html, css, wrapperSource, sourceComponent] = await Promise.all([
    Promise.resolve(renderToStaticMarkup(<DiscoverySignupReveal />)),
    readFile(new URL('./referenceDiscovery.css', import.meta.url), 'utf8'),
    readFile(new URL('./components/DiscoverySignupReveal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../artifacts/downloads/melius.com/reverse-engineering/home/react-demo/src/components/FooterEasterEgg.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /data-melius-source-component="FooterEasterEgg"/);
  assert.match(html, /data-app-icon-count="0"/);
  assert.match(wrapperSource, /import\('\.\.\/\.\.\/\.\.\/artifacts\/downloads\/melius\.com[\s\S]*FooterEasterEgg\.jsx'/);
  assert.match(wrapperSource, /ctaHref: '\/signin'/);
  assert.match(wrapperSource, /createElement\(AppIcon/);
  assert.match(wrapperSource, /initiallyRevealed: true/);
  assert.match(wrapperSource, /showTransitionStep: false/);
  assert.doesNotMatch(wrapperSource, /FooterDotBackground/);
  assert.match(sourceComponent, /data-card-variant=\{cardVariant\}/);
  assert.match(sourceComponent, /footer-easter-egg__card-reveal/);
  const revealCss = css.slice(css.indexOf('.discovery-signup-reveal'));
  assert.match(revealCss, /background:\s*#111112/);
  assert.doesNotMatch(revealCss, /radial-gradient/);
});
