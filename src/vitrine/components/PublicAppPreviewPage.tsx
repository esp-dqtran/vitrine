import type { ReactNode } from 'react';
import { Badge, Heading, Icon, IconButton, Text } from '@astryxdesign/core';
import type { PublicAppPreview } from '../publicAppPreviewApi.ts';
import { AstryxModal } from './AstryxModal.tsx';
import { ReferenceDetailNavigation } from './ReferenceDetailPage.tsx';

const evidenceCardStyle = {
  minWidth: 0,
  overflow: 'hidden',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  background: 'var(--color-background-surface)',
} as const;

function LockedEvidenceCard({ kind, onUnlock }: { kind: string; onUnlock: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Unlock more ${kind}`}
      onClick={onUnlock}
      style={{ ...evidenceCardStyle, position: 'relative', minHeight: 174, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
    >
      <div aria-hidden="true" style={{ padding: 14, filter: 'blur(5px)', opacity: 0.72 }}>
        <div style={{ height: 92, padding: 14, boxSizing: 'border-box', borderRadius: 10, background: 'color-mix(in srgb, var(--color-text-primary) 16%, var(--color-background-muted))' }}>
          <div style={{ width: '58%', height: 10, borderRadius: 5, background: 'color-mix(in srgb, var(--color-text-primary) 38%, transparent)' }} />
          <div style={{ width: '86%', height: 8, borderRadius: 5, marginTop: 13, background: 'color-mix(in srgb, var(--color-text-primary) 24%, transparent)' }} />
          <div style={{ width: '70%', height: 8, borderRadius: 5, marginTop: 9, background: 'color-mix(in srgb, var(--color-text-primary) 24%, transparent)' }} />
        </div>
        <div style={{ width: '72%', height: 12, borderRadius: 6, marginTop: 14, background: 'color-mix(in srgb, var(--color-text-primary) 26%, transparent)' }} />
        <div style={{ width: '46%', height: 10, borderRadius: 6, marginTop: 9, background: 'color-mix(in srgb, var(--color-text-primary) 20%, transparent)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: 'color-mix(in srgb, var(--color-background-surface) 18%, transparent)' }}>
        <Badge label="Unlock more" variant="neutral" />
      </div>
    </button>
  );
}

function EvidenceSection({
  title,
  summary,
  children,
  onUnlock,
  featured = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  onUnlock: () => void;
  featured?: boolean;
}) {
  return (
    <section aria-label={title} style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <Heading level={2}>{title}</Heading>
        <Text color="secondary">{summary}</Text>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: featured ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(174px, 1fr))', gap: 14, marginTop: 16 }}>
        {children}
        <LockedEvidenceCard kind={title.toLowerCase()} onUnlock={onUnlock} />
        <LockedEvidenceCard kind={title.toLowerCase()} onUnlock={onUnlock} />
      </div>
    </section>
  );
}

interface PublicAppPreviewContentProps {
  preview: PublicAppPreview;
  freeUnlocksRemaining: number | null;
  isGuest: boolean;
  onUnlock: () => void;
  presentation: 'page' | 'modal';
}

function PublicAppPreviewContent({
  preview,
  onUnlock,
  presentation,
}: PublicAppPreviewContentProps) {
  const { app, previewScreens } = preview;
  const previewUiElements = preview.previewUiElements ?? [];
  const previewFlows = preview.previewFlows ?? [];
  const featuredFlows = previewFlows.slice(0, 1);
  const isModal = presentation === 'modal';

  return (
    <div
      data-public-app-preview="true"
      className={isModal ? undefined : 'vitrine-page'}
      style={isModal
        ? { padding: '4px 4px 8px' }
        : { maxWidth: 1240, margin: '0 auto', padding: '40px 28px 80px' }}
    >
        <header style={{ maxWidth: 820, paddingRight: isModal ? 52 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {app.iconUrl ? (
              <img src={app.iconUrl} alt="" style={{ width: 72, height: 72, borderRadius: 20, flex: '0 0 auto' }} />
            ) : null}
            <Heading level={1} style={{ fontSize: 'clamp(42px, 6vw, 56px)', lineHeight: 1, letterSpacing: '-0.035em' }}>{app.app}</Heading>
          </div>
          {app.description ? (
            <div style={{ marginTop: 12 }}>
              <Text color="secondary">{app.description}</Text>
            </div>
          ) : null}
        </header>

        <EvidenceSection
          title="Screens"
          summary={`Showing ${previewScreens.length} of ${app.totalScreens}`}
          onUnlock={onUnlock}
        >
          {previewScreens.map((screen) => (
            <figure key={screen.id} style={{ ...evidenceCardStyle, margin: 0 }}>
              <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'var(--color-background-muted)' }}>
                <img
                  src={screen.thumbnailUrl ?? screen.url}
                  alt={`${app.app} ${screen.type}`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: screen.platform === 'ios' || screen.platform === 'android' ? 'contain' : 'cover' }}
                />
              </div>
              <figcaption style={{ padding: '12px 14px' }}>
                <Text weight="semibold">{screen.type}</Text>
                <div style={{ marginTop: 3 }}><Text color="secondary">{screen.productArea}</Text></div>
              </figcaption>
            </figure>
          ))}
        </EvidenceSection>

        <EvidenceSection
          title="UI Elements"
          summary={`Showing ${previewUiElements.length} of ${app.totalUiElements}`}
          onUnlock={onUnlock}
        >
          {previewUiElements.map((item) => (
            <article key={item.type} style={evidenceCardStyle}>
              <div style={{ aspectRatio: '4 / 3', overflow: 'hidden', background: 'var(--color-background-muted)' }}>
                <img
                  src={item.thumbnailUrl}
                  alt={`${app.app} ${item.type}`}
                  loading="lazy"
                  onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '12px 14px' }}>
                <Text weight="semibold">{item.type}</Text>
                <div style={{ marginTop: 3 }}>
                  <Text color="secondary">{item.group} · {item.count} observed</Text>
                </div>
              </div>
            </article>
          ))}
        </EvidenceSection>

        <EvidenceSection
          title="Flows"
          summary={`Showing ${featuredFlows.length} of ${app.totalFlows}`}
          onUnlock={onUnlock}
          featured
        >
          {featuredFlows.map((flow) => (
            <article key={flow.id} data-public-preview-featured-flow="true" style={{ ...evidenceCardStyle, gridColumn: '1 / -1' }}>
              <div style={{ height: 270, padding: 12, boxSizing: 'border-box', background: 'var(--color-background-muted)' }}>
                <div data-public-preview-flow-screen-strip="true" style={{ display: 'flex', gap: 12, height: '100%', overflowX: 'auto', overscrollBehaviorX: 'contain', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                  {(flow.screens ?? []).map((screen, index) => (
                    <figure key={`${flow.id}-${screen.thumbnailUrl}`} style={{ position: 'relative', flex: '0 0 min(76%, 520px)', height: '100%', margin: 0, overflow: 'hidden', scrollSnapAlign: 'start', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-background-body)' }}>
                      <img
                        src={screen.thumbnailUrl}
                        alt={`${flow.title}: ${screen.label}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <figcaption style={{ position: 'absolute', left: 6, bottom: 6, width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 11, fontWeight: 700, color: 'var(--color-background-body)', background: 'var(--color-text-primary)', boxShadow: 'var(--shadow-low)' }}>
                        {index + 1}
                      </figcaption>
                    </figure>
                  ))}
                  {(flow.screens ?? []).length === 0 ? (
                    <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}><Text color="secondary">Flow preview unavailable</Text></div>
                  ) : null}
                </div>
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <Text weight="semibold">{flow.title}</Text>
                <div style={{ marginTop: 6 }}>
                  <Text color="secondary">{flow.stepCount} steps · {(flow.screens ?? []).length} real screens</Text>
                </div>
              </div>
            </article>
          ))}
        </EvidenceSection>
    </div>
  );
}

function PublicAppPreviewLoading() {
  const block = (height: number, width = '100%') => (
    <div style={{ height, width, borderRadius: 10, background: 'var(--color-background-muted)' }} />
  );
  return (
    <div role="status" aria-label="Loading public app preview" style={{ padding: '12px 56px 20px 4px' }}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {block(72, 72)}
          {block(44, '42%')}
        </div>
      </div>
      {['Screens', 'UI Elements', 'Flows'].map((title) => (
        <section key={title} style={{ marginTop: 34 }}>
          <Heading level={2}>{title}</Heading>
          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
            {block(174)}{block(174)}{block(174)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PublicAppPreviewPage({
  preview,
  freeUnlocksRemaining,
  isGuest,
  accountControls,
  onOpenSearch,
  onUnlock,
}: Omit<PublicAppPreviewContentProps, 'presentation'> & {
  accountControls?: ReactNode;
  onOpenSearch: () => void;
}) {
  return (
    <>
      <ReferenceDetailNavigation
        kind="app"
        searchLabel="Search on Web..."
        onOpenSearch={onOpenSearch}
        accountControls={accountControls}
      />
      <PublicAppPreviewContent
        preview={preview}
        freeUnlocksRemaining={freeUnlocksRemaining}
        isGuest={isGuest}
        onUnlock={onUnlock}
        presentation="page"
      />
    </>
  );
}

export function PublicAppPreviewModal({
  preview,
  loading,
  error,
  freeUnlocksRemaining,
  isGuest,
  onUnlock,
  onClose,
}: {
  preview: PublicAppPreview | null;
  loading: boolean;
  error: string;
  freeUnlocksRemaining: number | null;
  isGuest: boolean;
  onUnlock: () => void;
  onClose: () => void;
}) {
  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="form"
      width={1120}
    >
      <div
        data-public-app-preview-modal="true"
        style={{ position: 'relative', maxHeight: '86vh', overflowY: 'auto', padding: 4 }}
      >
        <div data-public-preview-close="true" style={{ position: 'relative', zIndex: 5, height: 0 }}>
          <IconButton
            label="Close preview"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            onClick={onClose}
            style={{ position: 'absolute', top: 8, right: 8, borderRadius: '50%', background: 'var(--color-background-muted)', color: 'var(--color-text-primary)' }}
          />
        </div>
        {loading ? (
          <PublicAppPreviewLoading />
        ) : error ? (
          <div role="alert" style={{ minHeight: 280, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <Heading level={3}>Could not load preview</Heading>
              <div style={{ marginTop: 8 }}><Text color="secondary">{error}</Text></div>
            </div>
          </div>
        ) : preview ? (
          <PublicAppPreviewContent
            preview={preview}
            freeUnlocksRemaining={freeUnlocksRemaining}
            isGuest={isGuest}
            onUnlock={onUnlock}
            presentation="modal"
          />
        ) : null}
      </div>
    </AstryxModal>
  );
}
