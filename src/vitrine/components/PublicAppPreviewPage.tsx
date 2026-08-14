import { useState, type ReactNode } from 'react';
import { Button, Heading, Icon, IconButton, Text } from '@astryxdesign/core';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import { screenAspectRatio } from '../screenAspect.ts';
import type { PublicAppPreview } from '../publicAppPreviewApi.ts';
import { AppIcon } from './AppIcon.tsx';
import { AstryxModal } from './AstryxModal.tsx';
import { FlowCard } from './FlowCard.tsx';
import { ReferenceDetailNavigation } from './ReferenceDetailPage.tsx';
import { ReferenceGalleryGrid } from './ReferenceGallerySection.tsx';
import { ScreenGridCard } from './ScreenGridCard.tsx';

const evidenceCardStyle = {
  minWidth: 0,
  overflow: 'hidden',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  background: 'var(--color-background-surface)',
} as const;

const PUBLIC_FLOW_LIMIT = 6;

function LockedEvidenceCard({
  kind,
  onUnlock,
  aspectRatio,
}: {
  kind: string;
  onUnlock: () => void;
  aspectRatio?: string;
}) {
  return (
    <div style={{
      ...evidenceCardStyle,
      position: 'relative',
      minHeight: aspectRatio ? undefined : 174,
      aspectRatio,
    }}>
      <div aria-hidden="true" style={{ padding: 14, filter: 'blur(5px)', opacity: 0.72 }}>
        <div style={{ height: 92, padding: 14, boxSizing: 'border-box', borderRadius: 10, background: 'color-mix(in srgb, var(--color-text-primary) 16%, var(--color-background-muted))' }}>
          <div style={{ width: '58%', height: 10, borderRadius: 5, background: 'color-mix(in srgb, var(--color-text-primary) 38%, transparent)' }} />
          <div style={{ width: '86%', height: 8, borderRadius: 5, marginTop: 13, background: 'color-mix(in srgb, var(--color-text-primary) 24%, transparent)' }} />
          <div style={{ width: '70%', height: 8, borderRadius: 5, marginTop: 9, background: 'color-mix(in srgb, var(--color-text-primary) 24%, transparent)' }} />
        </div>
        <div style={{ width: '72%', height: 12, borderRadius: 6, marginTop: 14, background: 'color-mix(in srgb, var(--color-text-primary) 26%, transparent)' }} />
        <div style={{ width: '46%', height: 10, borderRadius: 6, marginTop: 9, background: 'color-mix(in srgb, var(--color-text-primary) 20%, transparent)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--color-background-surface) 18%, transparent)' }}>
        <Button
          label="Unlock more"
          aria-label={`Unlock more ${kind}`}
          variant="primary"
          size="md"
          onClick={onUnlock}
          style={{ font: 'var(--vitrine-type-action)', letterSpacing: '0.2px' }}
        />
      </div>
    </div>
  );
}

function EvidenceSection({
  title,
  summary,
  children,
  onUnlock,
  galleryLayout,
  lockedAspectRatio,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  onUnlock: () => void;
  galleryLayout?: 'mobile-screens' | 'web-screens';
  lockedAspectRatio?: string;
}) {
  const evidence = (
    <>
      {children}
      <LockedEvidenceCard kind={title.toLowerCase()} onUnlock={onUnlock} aspectRatio={lockedAspectRatio} />
      <LockedEvidenceCard kind={title.toLowerCase()} onUnlock={onUnlock} aspectRatio={lockedAspectRatio} />
    </>
  );
  return (
    <section aria-label={title} style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <Heading level={2}>{title}</Heading>
        <Text color="secondary">{summary}</Text>
      </div>
      <div style={{ marginTop: 16 }}>
        {galleryLayout ? (
          <ReferenceGalleryGrid minCardWidth={240} layout={galleryLayout}>
            {evidence}
          </ReferenceGalleryGrid>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(174px, 1fr))', gap: 14 }}>
            {evidence}
          </div>
        )}
      </div>
    </section>
  );
}

function previewFlowAsDesignFlow(
  flow: PublicAppPreview['previewFlows'][number],
): DesignFlow<EvidenceView> {
  return {
    id: flow.id,
    title: flow.title,
    description: flow.description ?? '',
    tags: [],
    steps: flow.screens.map((screen, index) => ({
      label: screen.label,
      evidence: [{
        imageId: index + 1,
        imageUrl: screen.imageUrl
          ?? screen.thumbnailUrl.replace(/([?&])variant=thumb(?=&|$)/, '$1variant=full'),
        thumbnailUrl: screen.thumbnailUrl,
        description: null,
      }],
    })),
  };
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
  const previewFlows = preview.previewFlows ?? [];
  const [showAllFlows, setShowAllFlows] = useState(false);
  const isModal = presentation === 'modal';
  const hasMoreFlows = !isModal && previewFlows.length > PUBLIC_FLOW_LIMIT;
  const visibleFlows = isModal
    ? previewFlows.slice(0, 1)
    : showAllFlows
      ? previewFlows
      : previewFlows.slice(0, PUBLIC_FLOW_LIMIT);
  const screenPlatform = previewScreens[0]?.platform ?? app.platforms[0] ?? 'web';
  const screenGalleryLayout = screenPlatform === 'web' ? 'web-screens' : 'mobile-screens';

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
            <AppIcon name={app.app} iconUrl={app.iconUrl} accent={app.accent} size={72} />
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
          galleryLayout={screenGalleryLayout}
          lockedAspectRatio={screenAspectRatio(screenPlatform)}
        >
          {previewScreens.map((screen, index) => (
            <ScreenGridCard
              key={screen.id}
              screen={screen}
              accent={app.accent}
              delay={Math.min(index * 0.04, 0.32)}
              appName={app.app}
              onOpen={onUnlock}
              showActions={false}
              showCategory={false}
            />
          ))}
        </EvidenceSection>

        <EvidenceSection
          title="Flows"
          summary={`Showing ${visibleFlows.length} of ${app.totalFlows}`}
          onUnlock={onUnlock}
        >
          {visibleFlows.map((flow) => {
            const flowScreenCount = flow.screens.length;
            const screenLabel = `${flowScreenCount} real ${flowScreenCount === 1 ? 'screen' : 'screens'}`;
            return (
              <div
                key={flow.id}
                className={isModal ? 'public-app-preview__flow public-app-preview__flow--modal' : undefined}
                style={{ gridColumn: '1 / -1' }}
              >
                <FlowCard
                  flow={previewFlowAsDesignFlow(flow)}
                  onOpen={onUnlock}
                  platform={flow.platform ?? app.platforms[0] ?? 'web'}
                  metaLabel={`${flow.stepCount} steps · ${screenLabel}`}
                  syncPreviewUrl={false}
                />
              </div>
            );
          })}
          {hasMoreFlows && !showAllFlows ? (
            <div
              data-public-preview-flow-expander="true"
              style={{
                gridColumn: '1 / -1',
                display: 'grid',
                placeItems: 'center',
                minHeight: 96,
                marginTop: -30,
                paddingTop: 42,
                background: 'linear-gradient(to bottom, transparent, var(--color-background-primary) 62%)',
              }}
            >
              <Button
                label={`Show all ${previewFlows.length} flows`}
                aria-expanded={false}
                variant="secondary"
                size="md"
                onClick={() => setShowAllFlows(true)}
              />
            </div>
          ) : null}
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
      {['Screens', 'Flows'].map((title) => (
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
            className="astryx-modal__icon-action"
            onClick={onClose}
            style={{ position: 'absolute', top: 8, right: 8 }}
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
