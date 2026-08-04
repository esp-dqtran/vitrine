import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiEventSource } from './apiEventSource.ts';
import { clearAuthToken, setAuthToken } from './apiFetch.ts';

test('streams named SSE events over an authenticated fetch', async (t) => {
  setAuthToken('header.payload.signature');
  t.after(clearAuthToken);
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer header.payload.signature');
    return new Response('event: progress\ndata: {"done":1}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    });
  });

  const source = createApiEventSource('/api/progress/stream');
  const data = await new Promise<string>((resolve) => {
    source.addEventListener('progress', ((event: MessageEvent<string>) => resolve(event.data)) as EventListener);
  });
  source.close();
  assert.equal(data, '{"done":1}');
});
