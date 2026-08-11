import { useState } from 'react';
import { Button, TextInput } from '@astryxdesign/core';
import {
  createAppRecord,
  researchCrawlApp,
  type AppMetadataIngestView,
} from '../researchApi.ts';
import { invalidateCatalogPageCache } from '../useApps.ts';

export function appSlugFromName(value: string): string {
  return value
    .replace(/[Đđ]/g, (character) => character === 'Đ' ? 'D' : 'd')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function AppIngestPanel({
  onOpenApp,
}: {
  onOpenApp(app: string): void;
}) {
  const [name, setName] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');
  const [result, setResult] = useState<AppMetadataIngestView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparationBusy, setPreparationBusy] = useState(false);
  const [preparationJobId, setPreparationJobId] = useState<number>();
  const [preparationError, setPreparationError] = useState('');
  const slug = appSlugFromName(name);

  const create = async () => {
    if (!slug || !homepageUrl.trim()) return;
    setBusy(true);
    setError('');
    setResult(undefined);
    setPreparationJobId(undefined);
    setPreparationError('');
    try {
      const created = await createAppRecord(slug, homepageUrl.trim());
      setResult(created);
      invalidateCatalogPageCache();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const prepareFlows = async () => {
    if (!result?.complete) return;
    setPreparationBusy(true);
    setPreparationError('');
    try {
      const prepared = await researchCrawlApp(result.app, result.websiteUrl);
      setPreparationJobId(prepared.jobId);
    } catch (cause) {
      setPreparationError((cause as Error).message);
    } finally {
      setPreparationBusy(false);
    }
  };

  return (
    <details
      className="apps-discovery__app-ingest"
      style={{
        border: '1px solid var(--border-subtle, #e5e7eb)',
        borderRadius: 12,
        padding: '14px 16px',
        background: 'var(--surface-primary, #fff)',
        marginBottom: 20,
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 650 }}>
        Stage 1 · Create App record
      </summary>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary, #667085)' }}>
          Create the App, then ingest its official icon and description and classify it into the existing category taxonomy. Screens and Flows do not start in this stage.
        </p>
        <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <TextInput label="App name" value={name} onChange={setName} width="100%" />
          </div>
          <div style={{ flex: '2 1 320px' }}>
            <TextInput
              label="Official App URL"
              value={homepageUrl}
              onChange={setHomepageUrl}
              placeholder="https://www.example.com"
              width="100%"
            />
          </div>
          <Button
            variant="primary"
            label={busy ? 'Creating App…' : 'Create App record'}
            isDisabled={busy || !slug || !homepageUrl.trim()}
            isLoading={busy}
            onClick={() => void create()}
          />
        </div>
        {slug ? <small>Record ID: <code>{slug}</code></small> : null}
        {error ? <p role="alert" style={{ color: '#b42318', margin: 0 }}>{error}</p> : null}
        {result ? (
          <article
            aria-label="Created App information"
            style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, borderRadius: 10, background: '#f8fafc' }}
          >
            {result.iconUrl ? (
              <img src={result.iconUrl} alt="" width="56" height="56" style={{ borderRadius: 12, objectFit: 'cover' }} />
            ) : null}
            <div style={{ display: 'grid', gap: 4, flex: 1 }}>
              <strong>{result.displayName ?? name}</strong>
              <span>{result.description ?? 'Description needs review.'}</span>
              {result.categories.length ? (
                <small>Categories: {result.categories.map(({ name: categoryName }) => categoryName).join(' · ')}</small>
              ) : null}
              <small>{result.complete ? 'Stage 1 complete' : `Needs attention: ${result.issues.join(', ')}`}</small>
            </div>
            <Button label="Open App record" onClick={() => onOpenApp(result.app)} />
          </article>
        ) : null}
        <section
          aria-label="Stage 2 Flow preparation"
          style={{ display: 'grid', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border-subtle, #e5e7eb)' }}
        >
          <div>
            <strong>Stage 2 · Research and prepare Flows</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #667085)' }}>
              Research public product pages, draft unreviewed Flows, and create one directory per Flow. This stage does not open the product or capture screens.
            </p>
          </div>
          <code style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary, #667085)' }}>
            {'flows/<flow-id>/flow.json\nflows/<flow-id>/screens/\nflows/<flow-id>/evidence/'}
          </code>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              label={preparationBusy ? 'Preparing Flows…' : 'Research and prepare Flows'}
              isDisabled={preparationBusy || !result?.complete}
              isLoading={preparationBusy}
              onClick={() => void prepareFlows()}
            />
            {!result?.complete ? <small>Complete Stage 1 first.</small> : null}
            {preparationJobId ? <small>Flow preparation queued · Job #{preparationJobId}</small> : null}
          </div>
          {preparationError ? <p role="alert" style={{ color: '#b42318', margin: 0 }}>{preparationError}</p> : null}
        </section>
      </div>
    </details>
  );
}
