import { Button, Heading, Text } from '@astryxdesign/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThreadsMarketingPost } from '../../threadsMarketing.ts';
import { ColorPackStack } from './ColorPackStack.tsx';
import {
  fetchThreadsMarketingDashboard,
  publishThreadsPaletteNow,
  refreshThreadsMetrics,
  type ThreadsMarketingDashboard,
} from '../threadsMarketingApi.ts';

function total(posts: readonly ThreadsMarketingPost[], metric: keyof ThreadsMarketingPost['metrics']): number {
  return posts.reduce((sum, post) => sum + post.metrics[metric], 0);
}

function publishState(post: ThreadsMarketingPost): string {
  if (post.status === 'published') return 'Published';
  if (post.status === 'failed') return 'Needs attention';
  return 'Draft';
}

export function ThreadsMarketingPage() {
  const [dashboard, setDashboard] = useState<ThreadsMarketingDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'publish' | 'metrics' | null>(null);
  const load = useCallback(async () => {
    try { setDashboard(await fetchThreadsMarketingDashboard()); setError(null); }
    catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const posts = dashboard?.posts ?? [];
  const latest = posts[0];
  const metrics = useMemo(() => ({
    views: total(posts, 'views'), likes: total(posts, 'likes'), replies: total(posts, 'replies'), shares: total(posts, 'shares'),
  }), [posts]);
  const publish = async () => {
    setBusy('publish');
    try { await publishThreadsPaletteNow(); await load(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  };
  const refresh = async () => {
    setBusy('metrics');
    try { await refreshThreadsMetrics(); await load(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <main className="threads-marketing" data-admin-page="threads-marketing">
      <header className="projects-workspace__page-header">
        <div>
          <p className="threads-marketing__eyebrow">Marketing channel</p>
          <Heading level={1}>Threads</Heading>
          <Text color="secondary">A daily palette, rendered, captioned, published, and measured in one place.</Text>
        </div>
        <div className="threads-marketing__header-actions">
          <Button label={busy === 'metrics' ? 'Refreshing…' : 'Refresh traction'} variant="secondary" isDisabled={Boolean(busy) || !dashboard?.configured} clickAction={() => void refresh()} />
          <Button label={busy === 'publish' ? 'Publishing…' : 'Publish palette now'} isDisabled={Boolean(busy) || !dashboard?.configured} clickAction={() => void publish()} />
        </div>
      </header>

      {error ? <p className="threads-marketing__error" role="alert">{error}</p> : null}
      {!dashboard ? <p className="threads-marketing__loading">Loading the Threads channel…</p> : (
        <>
          <section className={`threads-marketing__connection${dashboard.configured ? ' is-ready' : ''}`}>
            <strong>{dashboard.configured ? 'Threads account connected' : 'Threads account needs connecting'}</strong>
            <span>{dashboard.configured ? `Daily publishing at ${dashboard.dailyTime} (${dashboard.timeZone}).` : 'Set the Threads API credentials and public image URL in the API environment. Publishing and metric refresh stay disabled until the connection is ready.'}</span>
          </section>

          <section className="threads-marketing__metrics" aria-label="Threads channel traction">
            <Metric label="Views" value={metrics.views} />
            <Metric label="Likes" value={metrics.likes} />
            <Metric label="Replies" value={metrics.replies} />
            <Metric label="Shares" value={metrics.shares} />
          </section>

          <section className="threads-marketing__content">
            <article className="threads-marketing__latest">
              <p className="threads-marketing__eyebrow">Latest post</p>
              {latest ? <>
                <ColorPackStack
                  label={`${latest.paletteDate} Threads palette`}
                  initiallyExpanded={false}
                  cards={latest.palette.colors.map((color, index) => ({
                    id: color.role, name: color.name, hex: color.hex, color: color.hex, foreground: color.foreground,
                    role: index === 0 ? 'lead' : index === 1 ? 'accent' : 'companion', outlined: index === 2,
                  }))}
                />
                <p className="threads-marketing__caption">{latest.caption}</p>
              </> : <p className="threads-marketing__empty">Your first palette will appear here after a daily or on-demand run.</p>}
            </article>
            <article className="threads-marketing__history">
              <p className="threads-marketing__eyebrow">Post history</p>
              {posts.length ? <ol className="threads-marketing__post-list">
                {posts.map((post) => <li key={post.id}>
                  <span><strong>{post.paletteDate}</strong><small>{post.palette.harmony}</small></span>
                  <span className={`threads-marketing__status is-${post.status}`}>{publishState(post)}</span>
                  <span>{post.metrics.views.toLocaleString()} views</span>
                </li>)}
              </ol> : <p className="threads-marketing__empty">No posts yet.</p>}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value.toLocaleString()}</strong></div>;
}
