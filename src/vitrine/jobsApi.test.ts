import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitImportJob } from './jobsApi.ts';

test('submits an import without listing jobs', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string | undefined; body: string | undefined }> = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(JSON.stringify({ id: 42 }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  await submitImportJob(
    'linear',
    'https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/screens',
    'web',
  );

  assert.deepEqual(requests, [{
    url: '/api/jobs',
    method: 'POST',
    body: JSON.stringify({
      type: 'import-app',
      name: 'linear',
      url: 'https://mobbin.com/apps/linear-web-00000000-0000-0000-0000-000000000000/screens',
      platform: 'web',
    }),
  }]);
});
