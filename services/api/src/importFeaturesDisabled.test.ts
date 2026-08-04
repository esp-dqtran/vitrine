import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import test from 'node:test';
import { createApiApp } from './app.ts';

const admin = { id: 1, email: 'admin@example.com', role: 'admin' as const };
const adminHeaders = {
  authorization: 'Bearer admin',
  'content-type': 'application/json',
};

async function serve(app: ReturnType<typeof createApiApp>) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return { base: `http://127.0.0.1:${address.port}`, server };
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('rejects every product import and recapture request before touching jobs or versions', async (t) => {
  const touched: string[] = [];
  const { base, server } = await serve(createApiApp({
    verifyAuthToken: async () => admin,
    createJob: async () => {
      touched.push('create-job');
      return 1;
    },
    publishJob: async () => {
      touched.push('publish-app-job');
    },
    publishSitesJob: async () => {
      touched.push('publish-site-job');
    },
    publishPublicPageJob: async () => {
      touched.push('publish-public-page-job');
    },
  } as never));
  t.after(() => close(server));

  const jobRequests = [
    { type: 'discover-catalog' },
    {
      type: 'import-app',
      name: 'linear',
      platform: 'web',
      url: 'https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/version/screens',
    },
    { type: 'import-site', url: 'https://example.com/' },
    { type: 'crawl-public-page', url: 'https://example.com/pricing' },
  ];
  for (const body of jobRequests) {
    const response = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'Imports are disabled' });
  }

  for (const body of [
    { platform: 'web' },
    { platform: 'web', sourceUrl: 'https://mobbin.com/apps/linear/version/screens' },
  ]) {
    const response = await fetch(`${base}/apps/linear/versions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: 'Imports are disabled' });
  }

  assert.deepEqual(touched, []);
});
