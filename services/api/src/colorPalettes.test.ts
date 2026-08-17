import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import test from 'node:test';
import { defaultColorCollections, defaultColorPalettes } from '../../../src/colorPalettes.ts';
import { createApiApp } from './app.ts';

const user = { id: 2, email: 'color@example.com', role: 'user' as const };

async function serve(app: ReturnType<typeof createApiApp>) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return { base: `http://127.0.0.1:${address.port}`, server };
}

const close = (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

test('returns the authenticated palette library with collection metadata', async (t) => {
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => user,
    colorPaletteStore: {
      list: async () => [...defaultColorPalettes],
      listCollections: async () => [...defaultColorCollections],
    },
  } as never));
  t.after(() => close(server));

  const response = await fetch(`${base}/color-palettes`, {
    headers: { authorization: 'Bearer color' },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /max-age=300/);
  const body = await response.json() as { items: unknown[]; collections: unknown[] };
  assert.equal(body.items.length, 58);
  assert.equal(body.collections.length, 8);
});
