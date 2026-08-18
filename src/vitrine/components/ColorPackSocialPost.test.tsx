import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultColorPalettes } from '../../colorPalettes.ts';
import { ColorPackSocialPost } from './ColorPackSocialPost.tsx';

test('composes the production Color Pack Stack inside a 1080 by 1350 social frame', () => {
  const palette = defaultColorPalettes.find(({ id }) => id === 'quiet-authority');
  assert.ok(palette);

  const html = renderToStaticMarkup(<ColorPackSocialPost palette={palette} />);

  assert.match(html, /Quiet Authority Color Pack social image/);
  assert.match(html, /Color Pack 001/);
  assert.match(html, /@vitrines_ai/);
  assert.match(html, /color-pack-stack/);
  assert.match(html, /#151311/);
  assert.match(html, /Obsidian Ink/);
  assert.doesNotMatch(html, />HEX</);
  assert.match(html, /--color-pack-card-height:236px/);
  assert.match(html, /color-pack-social-post__footer/);
});
