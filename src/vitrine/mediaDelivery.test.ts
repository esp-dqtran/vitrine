import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inlineMediaUrl,
  isProtectedMediaUrl,
  loadCachedProtectedMediaUrl,
  loadProtectedMediaObjectUrl,
  loadProtectedMediaUrl,
  signedMediaRequestUrl,
} from './mediaDelivery.ts';

test('reuses a recently signed protected-media URL', async () => {
  const signal = new AbortController().signal;
  let requests = 0;
  const request = async () => {
    requests += 1;
    return Response.json({ url: 'https://objects.example/prefetched-screen.png?token=temporary' });
  };

  const first = await loadCachedProtectedMediaUrl(
    '/api/media/cache-test/adjacent-screen',
    signal,
    request,
  );
  const second = await loadCachedProtectedMediaUrl(
    '/api/media/cache-test/adjacent-screen',
    signal,
    request,
  );

  assert.equal(first, second);
  assert.equal(requests, 1);
});

test('marks protected API media for authenticated inline delivery', () => {
  const source = '/api/media/aboard/0123456789abcdef?variant=thumb';
  assert.equal(isProtectedMediaUrl(source), true);
  assert.equal(
    inlineMediaUrl(source),
    '/api/media/aboard/0123456789abcdef?variant=thumb&delivery=inline',
  );
  assert.equal(isProtectedMediaUrl('/api/preview-media/aboard/web/1'), false);
  assert.equal(inlineMediaUrl('https://objects.example/screen.png'), 'https://objects.example/screen.png');
});

test('requests a short-lived signed URL for protected browser media', async () => {
  const controller = new AbortController();
  let requested = '';
  let requestedSignal: AbortSignal | null | undefined;
  const signedUrl = await loadProtectedMediaUrl(
    '/api/media/aboard/0123456789abcdef?variant=thumb',
    controller.signal,
    async (input, init) => {
      requested = String(input);
      requestedSignal = init?.signal;
      return Response.json({ url: 'https://objects.example/signed-screen.png?token=temporary' });
    },
  );

  assert.equal(
    requested,
    '/api/media/aboard/0123456789abcdef?variant=thumb&delivery=url',
  );
  assert.equal(requestedSignal, controller.signal);
  assert.equal(signedUrl, 'https://objects.example/signed-screen.png?token=temporary');
  assert.equal(
    signedMediaRequestUrl('/api/media/aboard/0123456789abcdef'),
    '/api/media/aboard/0123456789abcdef?delivery=url',
  );
});

test('rejects missing and unsafe signed media URLs', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    loadProtectedMediaUrl(
      '/api/media/aboard/0123456789abcdef',
      signal,
      async () => Response.json({}),
    ),
    /has no URL/,
  );
  await assert.rejects(
    loadProtectedMediaUrl(
      '/api/media/aboard/0123456789abcdef',
      signal,
      async () => Response.json({ url: 'http://objects.example/screen.png' }),
    ),
    /invalid URL/,
  );
});

test('loads protected media through the authenticated requester and creates an object URL', async () => {
  const controller = new AbortController();
  let requested = '';
  let requestedSignal: AbortSignal | null | undefined;
  const objectUrl = await loadProtectedMediaObjectUrl(
    '/api/media/aboard/0123456789abcdef?variant=thumb',
    controller.signal,
    async (input, init) => {
      requested = String(input);
      requestedSignal = init?.signal;
      return new Response(new Blob(['image-bytes'], { type: 'image/png' }));
    },
    (blob) => `blob:test:${blob.type}:${blob.size}`,
  );

  assert.equal(requested, '/api/media/aboard/0123456789abcdef?variant=thumb&delivery=inline');
  assert.equal(requestedSignal, controller.signal);
  assert.equal(objectUrl, 'blob:test:image/png:11');
});

test('rejects failed and non-image protected media responses', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    loadProtectedMediaObjectUrl(
      '/api/media/aboard/0123456789abcdef',
      signal,
      async () => new Response('missing', { status: 404 }),
    ),
    /Media request failed with 404/,
  );
  await assert.rejects(
    loadProtectedMediaObjectUrl(
      '/api/media/aboard/0123456789abcdef',
      signal,
      async () => new Response('not an image', { headers: { 'content-type': 'text/plain' } }),
    ),
    /not an image/,
  );
});
