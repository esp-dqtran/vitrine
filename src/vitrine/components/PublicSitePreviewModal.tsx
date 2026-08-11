import { Button, Heading, Icon, IconButton, Text } from '@astryxdesign/core';
import type { SiteSummary } from '../types.ts';
import { AppIcon } from './AppIcon.tsx';
import { AstryxModal } from './AstryxModal.tsx';

export function PublicSitePreviewModal({
  site,
  onClose,
  onOpenDetail,
}: {
  site: SiteSummary;
  onClose: () => void;
  onOpenDetail: () => void;
}) {
  const isVideo = site.previewMediaKind !== 'image';
  const posterUrl = site.posterUrl ?? site.previews[0]?.url;

  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="form"
      width={1120}
    >
      <div
        data-public-site-preview-modal="true"
        style={{ position: 'relative', maxHeight: '86vh', overflowY: 'auto', padding: 20 }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
          <IconButton
            label="Close preview"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            className="astryx-modal__icon-action"
            onClick={onClose}
          />
        </div>

        <header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 52 }}>
          <AppIcon name={site.name} iconUrl={site.logoUrl} size={56} fit="contain" />
          <div>
            <Heading level={1}>{site.name}</Heading>
            {site.description ? <Text color="secondary">{site.description}</Text> : null}
          </div>
        </header>

        <section aria-label="Site preview" style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <Heading level={2}>Preview</Heading>
            <Button label="Open full Site detail" variant="secondary" onClick={onOpenDetail} />
          </div>
          <div style={{ marginTop: 14, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-background-muted)' }}>
            {isVideo ? (
              <video
                src={site.previewUrl}
                poster={posterUrl}
                controls
                muted
                playsInline
                preload="metadata"
                style={{ display: 'block', width: '100%', maxHeight: 520, background: 'var(--color-background-body)' }}
              />
            ) : (
              <img
                src={site.previewUrl}
                alt={`${site.name} website preview`}
                style={{ display: 'block', width: '100%', maxHeight: 520, objectFit: 'contain', background: 'var(--color-background-body)' }}
              />
            )}
          </div>
        </section>

        <section aria-label="Pages" style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
            <Heading level={2}>Pages</Heading>
            <Text color="secondary">Showing {site.previews.length} of {site.pageCount}</Text>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
            {site.previews.map((page) => (
              <figure key={page.id} style={{ margin: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-background-surface)' }}>
                <img
                  src={page.url}
                  alt={`${site.name} ${page.title} page preview`}
                  loading="lazy"
                  style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'contain', background: 'var(--color-background-muted)' }}
                />
                <figcaption style={{ padding: '10px 12px' }}><Text weight="semibold">{page.title}</Text></figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </AstryxModal>
  );
}
