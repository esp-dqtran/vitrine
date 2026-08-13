import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeCanvasScreenInsertBatch,
  storeCanvasScreenInsertBatch,
  consumeCanvasScreenInsertIntent,
  storeCanvasScreenInsertIntent,
} from './canvasInsertIntent.ts';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

test('hands canvas screen inserts off once', () => {
  const target = storage();
  const item = {
    appId: 'linear',
    appName: 'Linear',
    screen: {
      id: 42,
      type: 'Dashboard',
      productArea: 'Workspace',
      theme: 'light' as const,
      visibleStates: [],
      platform: 'web',
      description: null,
      url: '/screen.png',
    },
  };

  const token = storeCanvasScreenInsertIntent([item], target);
  assert.deepEqual(consumeCanvasScreenInsertIntent(token, target), [item]);
  assert.deepEqual(consumeCanvasScreenInsertIntent(token, target), []);
});

test('keeps the in-memory handoff when browser storage is cleared during navigation', () => {
  const target = storage();
  const item = {
    appId: 'linear',
    appName: 'Linear',
    screen: {
      id: 43,
      type: 'Settings',
      productArea: 'Account',
      theme: 'light' as const,
      visibleStates: [],
      platform: 'web',
      description: null,
      url: '/settings.png',
    },
  };
  const token = storeCanvasScreenInsertIntent([item], target);
  target.removeItem(`vitrines:canvas-screen-insert:${token}`);
  assert.deepEqual(consumeCanvasScreenInsertIntent(token, target), [item]);
});

test('drops malformed canvas insert handoffs', () => {
  const target = storage();
  target.setItem('vitrines:canvas-screen-insert:broken', '{');
  assert.deepEqual(consumeCanvasScreenInsertIntent('broken', target), []);
});

test('hands a multi-canvas insert off to each selected canvas in order', () => {
  const target = storage();
  const item = {
    appId: 'linear', appName: 'Linear',
    screen: { id: 44, type: 'Settings', productArea: 'Account', theme: 'light' as const, visibleStates: [], platform: 'web', description: null, url: '/settings.png' },
  };
  const first = { projectId: 'project-a', canvasId: 'canvas-a' };
  const second = { projectId: 'project-b', canvasId: 'canvas-b' };
  const token = storeCanvasScreenInsertBatch([item], [first, second], target);
  assert.deepEqual(consumeCanvasScreenInsertBatch(token, first, target), { items: [item], next: second });
  assert.deepEqual(consumeCanvasScreenInsertBatch(token, second, target), { items: [item], next: undefined });
  assert.equal(consumeCanvasScreenInsertBatch(token, second, target), undefined);
});
