import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared media cards keep evidence uncropped and free of badge overlays', () => {
  const mediaCard = read('./components/MediaGridCard.tsx');

  assert.match(mediaCard, /imageFit = 'contain'/);
  assert.match(mediaCard, /<video[\s\S]*objectFit: 'contain'/);
  assert.doesNotMatch(mediaCard, /badges\??:/);
  assert.doesNotMatch(mediaCard, /<Badge/);
});

test('screen evidence consumers request the best available source', () => {
  const screenCard = read('./components/ScreenGridCard.tsx');
  const appsDiscovery = read('./components/AppsDiscoveryScreenCard.tsx');
  const projectLibrary = read('./components/ProjectScreenLibrary.tsx');
  const publicPreview = read('./components/PublicAppPreviewPage.tsx');

  assert.match(screenCard, /preferFullImage/);
  assert.match(screenCard, /preserveNaturalAspectRatio/);
  assert.match(appsDiscovery, /src=\{screen\.url\}/);
  assert.match(projectLibrary, /src=\{screen\.url\}/);
  assert.match(publicPreview, /src=\{screen\.url\}/);
});

test('flow and dialog evidence use contain fit on every platform', () => {
  const flowCard = read('./components/FlowCard.tsx');
  const flowDialog = read('./components/FlowPreviewDialog.tsx');
  const screenDialog = read('./components/ScreenPreviewDialog.tsx');
  const dialogCss = read('./flowPreviewDialog.css');

  assert.doesNotMatch(flowCard, /objectFit: platform === 'web' \? 'contain' : 'cover'/);
  assert.doesNotMatch(flowDialog, /objectFit: platform === 'web' \? 'contain' : 'cover'/);
  assert.doesNotMatch(screenDialog, /objectFit: 'cover'/);
  assert.match(dialogCss, /\.flow-preview-dialog__screen > img[\s\S]*object-fit: contain/);
  assert.doesNotMatch(dialogCss, /\.flow-preview-dialog__screen > img[\s\S]{0,160}object-fit: cover/);
});
