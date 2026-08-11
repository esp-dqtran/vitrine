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
          <Heading level={2}>Preview</Heading>
          <div style={{ marginTop: 14, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 14, background: 'var(--color-background-muted)' }}>
            {isVideo ? (
              <video
                src={site.previewUrl}
                poster={posterUrl}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                aria-hidden="true"
                tabIndex={-1}
                style={{ display: 'block', width: '100%', maxHeight: 520, pointerEvents: 'none', background: 'var(--color-background-body)' }}
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

        <section aria-label="Design system preview" style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <Heading level={2}>Design system</Heading>
            <Text color="secondary">Available in full Site detail</Text>
          </div>
          <div
            data-public-site-design-system-preview="true"
            style={{
              position: 'relative', marginTop: 14, height: 280, overflow: 'hidden',
              border: '1px solid var(--color-border)', borderRadius: 14,
              background: 'var(--color-background-surface)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 0.8fr)',
                gap: 24, padding: 24, filter: 'blur(8px)', transform: 'scale(1.03)',
              }}
            >
              <div>
                <Text type="label" weight="semibold">Colors</Text>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  {['#111111', '#ffffff', '#8b5cf6', '#22c55e', '#f59e0b'].map((color) => (
                    <span key={color} style={{ width: 44, height: 44, borderRadius: '50%', background: color, border: '1px solid var(--color-border)' }} />
                  ))}
                </div>
                <Text type="label" weight="semibold" style={{ display: 'block', marginTop: 30 }}>Typography</Text>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <span style={{ height: 22, width: '76%', borderRadius: 6, background: 'var(--color-text-primary)' }} />
                  <span style={{ height: 14, width: '58%', borderRadius: 6, background: 'var(--color-text-secondary)' }} />
                  <span style={{ height: 12, width: '66%', borderRadius: 6, background: 'var(--color-text-secondary)' }} />
                </div>
              </div>
              <div style={{ padding: 18, border: '1px solid var(--color-border)', borderRadius: 12 }}>
                <Text type="label" weight="semibold">Foundations</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 18 }}>
                  {[16, 24, 32, 48, 12, 20, 28, 40].map((size, index) => (
                    <span key={`${size}-${index}`} style={{ height: size, borderRadius: 8, background: index % 2 ? 'var(--color-background-muted)' : 'var(--color-background-inverse)' }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--color-background-surface) 28%, transparent)' }}>
              <Button label="View full design system" variant="secondary" onClick={onOpenDetail} />
            </div>
          </div>
        </section>
      </div>
    </AstryxModal>
  );
}
