import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';
import { screenAspectRatio } from '../screenAspect';

interface LightboxItem {
  /** Real image URL, when the item comes from a crawl. */
  url?: string;
  /** Optional stable key for a neutral unavailable-preview state. */
  seed?: string;
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,11,0.94)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        animation: 'vtOverlayIn .2s ease both',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
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
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'vtScaleIn .3s cubic-bezier(.16,1,.3,1) both',
        }}
      >
        <PlaceholderImage src={item.url} seed={item.seed} style={{ objectFit: 'contain' }} />
        {total > 1 && <ArrowButton direction="left" visible onClick={() => onNavigate(index - 1)} />}
        {total > 1 && <ArrowButton direction="right" visible onClick={() => onNavigate(index + 1)} />}
      </div>
      <div style={{ marginTop: 16, fontSize: 13.5, color: '#d4d4d8' }}>
        {item.caption} — {index + 1} of {total}
      </div>
    </div>
  );
}
