import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FOUNDATION_TOKEN_CONTRACT,
  MOTION_SCALE,
  UI_FOUNDATION_STANDARD,
} from './uiFoundationStandard.ts';

const read = (file: string) => readFile(new URL(file, import.meta.url), 'utf8');

test('publishes the three-speed Vitrines motion contract', async () => {
  const foundation = await read('./uiFoundation.css');

  assert.deepEqual(
    MOTION_SCALE.map(({ token, value }) => [token, value]),
    [
      ['--vitrine-motion-fast', '120ms'],
      ['--vitrine-motion-medium', '180ms'],
      ['--vitrine-motion-slow', '240ms'],
    ],
  );
  FOUNDATION_TOKEN_CONTRACT.motion.forEach((token) => {
    assert.match(foundation, new RegExp(`${token}:\\s*`), `missing motion token: ${token}`);
  });
  assert.equal(UI_FOUNDATION_STANDARD.motionSource, 'Vitrines product screens');
  assert.match(UI_FOUNDATION_STANDARD.motionPolicy, /opacity and transform/);
  assert.match(UI_FOUNDATION_STANDARD.motionPolicy, /reduced-motion/);
});

test('loads the Apps motion pilot after the other visual foundations', async () => {
  const main = await read('./main.tsx');
  const motionImport = main.indexOf("import './productMotion.css'");

  assert.ok(motionImport > main.indexOf("import './productIconography.css'"));
  assert.ok(motionImport > main.indexOf("import './productShape.css'"));
});

test('rolls the motion contract across standard product screens', async () => {
  const styles = await read('./productMotion.css');

  assert.match(styles, /\.apps-discovery/);
  assert.match(styles, /\.sites-discovery/);
  assert.match(styles, /\.site-detail/);
  assert.match(styles, /\.reference-detail\[data-reference-detail="app"\]/);
  assert.match(styles, /\.projects-workspace/);
  assert.match(styles, /\.settings-workspace/);
  assert.match(styles, /\[data-admin-dashboard="true"\]/);
  assert.match(styles, /body:has\(\.apps-discovery\) \.apps-top-nav/);
  assert.match(styles, /--vitrine-transition-fast/);
  assert.match(styles, /--vitrine-transition-standard/);
  assert.match(styles, /--vitrine-transition-slow/);
  assert.doesNotMatch(styles, /body:has\(\.flows-discovery\)/);
});

test('defines direct, local, and reduced-motion interaction behavior', async () => {
  const styles = await read('./productMotion.css');

  assert.match(styles, /\.app-discovery-card[\s\S]*animation-duration:\s*var\(--vitrine-motion-slow\)/);
  assert.match(styles, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)/);
  assert.match(styles, /translateY\(-2px\)/);
  assert.match(styles, /:active[\s\S]*scale\(\.995\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /animation-iteration-count:\s*1\s*!important/);
  assert.match(styles, /transform:\s*none\s*!important/);
  assert.match(styles, /\.flow-workspace \*/);
  assert.match(styles, /\.project-document__editor \*/);
  assert.match(styles, /\.project-canvas-document-editor \*/);
  assert.match(styles, /\.screen-grid-card__media \*/);
  assert.match(styles, /\.excalidraw \*/);
});

test('transitions Apps and Screens result modes without ignoring reduced motion', async () => {
  const styles = await read('./productMotion.css');

  assert.match(styles, /@keyframes apps-discovery-results-enter/);
  assert.match(styles, /\.apps-discovery__results-transition,[\s\S]*animation:\s*apps-discovery-results-enter\s+var\(--vitrine-motion-medium\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.apps-discovery__results-transition,[\s\S]*animation:\s*none\s*!important/);
});

test('gives selected discovery filters a medium active-state transition', async () => {
  const css = await readFile(new URL('./productMotion.css', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.apps-discovery \.apps-filterbar__filter\s*\{[^}]*transition-property:\s*border-color, background-color, box-shadow;[^}]*transition-duration:\s*var\(--vitrine-motion-medium\)\s*!important;/,
  );
});

test('uses the slow token for standard drawers and dialogs but not Flow previews', async () => {
  const styles = await read('./productMotion.css');

  assert.match(styles, /\.projects-team-drawer[\s\S]*animation-duration:\s*var\(--vitrine-motion-slow\)/);
  assert.match(styles, /dialog\.astryx-modal\.astryx-modal--dialog:not\(\.flow-preview-dialog-shell\)/);
});

test('standardizes reference detail motion and honors reduced motion', async () => {
  const shell = await read('./components/ReferenceDetailShell.tsx');

  assert.match(shell, /useSlidingIndicator/);
  assert.doesNotMatch(shell, /framer-motion|duration:\s*0\.(35|42)/);
});

test('documents the motion scale in Storybook', async () => {
  const story = await read('../stories/Foundations/Motion.stories.tsx');

  assert.match(story, /FOUNDATION 06 · MOTION/);
  assert.match(story, /120ms/);
  assert.match(story, /180ms/);
  assert.match(story, /240ms/);
  assert.match(story, /prefers-reduced-motion/);
});
