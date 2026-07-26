import { Dialog, Icon, IconButton } from '@astryxdesign/core';
import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';
import { screenAspectRatio } from '../screenAspect';

interface LightboxItem {
  /** Real image URL, when the item comes from a crawl. */
  url?: string;
  /** Optional stable key for a neutral unavailable-preview state. */
  seed?: string;
  kind?: 'image' | 'video';
  posterUrl?: string;
  type: string;
  caption: string;
  platform?: string;
}

interface LightboxProps {
  item: LightboxItem;
  index: number;
  total: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ item, index, total, onClose, onNavigate }: LightboxProps) {
  return (
    <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="fullscreen" purpose="info" padding={0}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: 'color-mix(in srgb, var(--color-background-body) 94%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, boxSizing: 'border-box' }}>
      <IconButton
        label="Close"
        icon={<Icon icon="close" size="sm" />}
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          borderRadius: '50%',
          background: 'var(--color-background-muted)',
          color: 'var(--color-text-primary)',
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(880px, 90vw)',
          aspectRatio: screenAspectRatio(item.platform ?? 'web'),
          maxHeight: '80vh',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--color-background-muted)',
          boxShadow: 'var(--shadow-high)',
          animation: 'vtScaleIn .3s cubic-bezier(.16,1,.3,1) both',
        }}
      >
        {item.kind === 'video'
          ? <video src={item.url} poster={item.posterUrl} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <PlaceholderImage src={item.url} seed={item.seed} style={{ objectFit: 'contain' }} />}
        {total > 1 && <ArrowButton direction="left" visible onClick={() => onNavigate(index - 1)} />}
        {total > 1 && <ArrowButton direction="right" visible onClick={() => onNavigate(index + 1)} />}
      </div>
      <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--color-text-secondary)' }}>
        {item.caption} — {index + 1} of {total}
      </div>
      </div>
    </Dialog>
  );
}
