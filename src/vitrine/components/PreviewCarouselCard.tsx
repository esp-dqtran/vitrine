import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Badge, ClickableCard, Icon, Text, ToggleButton } from '@astryxdesign/core';
import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';

export interface PreviewCarouselItem {
  key: string;
  url?: string;
  alt: string;
}

interface PreviewCarouselCardProps {
  label: string;
  identityKey: string;
  identityLabel: string;
  identityImageUrl?: string | null;
  accent?: string;
  supportingText?: string;
  overlayLabel: string;
  previews: PreviewCarouselItem[];
  cornerBadge?: ReactNode;
  onOpen: () => void;
}

export function PreviewCarouselCard({
  label,
  identityKey,
  identityLabel,
  identityImageUrl,
  accent,
  supportingText,
  overlayLabel,
  previews,
  cornerBadge,
  onOpen,
}: PreviewCarouselCardProps) {
  const [hovered, setHovered] = useState(false);
  const [index, setIndex] = useState(0);
  const [activated, setActivated] = useState(false);
  const items = previews.slice(0, 5);
  const count = Math.max(items.length, 1);
  const go = (next: number) => {
    setActivated(true);
    setIndex(((next % count) + count) % count);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => { setHovered(true); setActivated(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 240px',
        transition: 'transform .28s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-6px) scale(1.01)' : 'none',
      }}
    >
      <ClickableCard label={label} onClick={onOpen} padding={0} variant="muted" height="100%" style={{ position: 'relative', overflow: 'hidden', boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            width: `${count * 100}%`,
            height: '100%',
            transform: `translateX(-${index * (100 / count)}%)`,
            transition: 'transform .38s cubic-bezier(.16,1,.3,1)',
            pointerEvents: 'none',
          }}
        >
          {(items.length ? items : [{ key: 'unavailable', alt: `${identityLabel} preview` }]).map((item, i) => (
            <div key={item.key} aria-label={item.alt} style={{ flex: `0 0 ${100 / count}%`, height: '100%', position: 'relative' }}>
              {(i === 0 || activated) && <PlaceholderImage src={item.url} accent={accent} />}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999, background: 'rgba(255,255,255,0.94)', boxShadow: 'var(--shadow-low)' }}>
          <motion.div layoutId={identityKey} style={{ width: 20, height: 20, borderRadius: 6, background: identityImageUrl ? 'transparent' : accent, flex: '0 0 auto', overflow: 'hidden', position: 'relative' }}>
            {identityImageUrl && <img src={identityImageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
          </motion.div>
          <Text type="supporting" weight="semibold"><span style={{ color: '#18181b' }}>{identityLabel}</span></Text>
          {supportingText && <Text type="supporting"><span style={{ color: '#71717a' }}>· {supportingText}</span></Text>}
        </div>

        {cornerBadge && <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, boxShadow: 'var(--shadow-low)' }}>{cornerBadge}</div>}

        <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', opacity: hovered ? 1 : 0, transition: 'opacity .22s cubic-bezier(.16,1,.3,1)', pointerEvents: 'none' }}>
          <Badge label={overlayLabel} variant="neutral" style={{ color: '#fff', background: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(4px)' }} />
        </div>

        {items.length > 1 && <ArrowButton direction="left" visible={hovered} onClick={() => go(index - 1)} />}
        {items.length > 1 && <ArrowButton direction="right" visible={hovered} onClick={() => go(index + 1)} />}
        {items.length > 1 && (
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 3 }}>
            {items.map((item, i) => (
              <ToggleButton
                key={item.key}
                label={`Show preview ${i + 1}`}
                isPressed={i === index}
                isIconOnly
                size="sm"
                icon={<Icon icon="stop" size="sm" />}
                onPressedChange={(_, event) => { event.stopPropagation(); go(i); }}
                style={{ width: i === index ? 14 : 5, height: 5, minWidth: i === index ? 14 : 5, minHeight: 5, padding: 0, color: i === index ? '#fff' : 'rgba(255,255,255,0.55)', transition: 'width .15s ease' }}
              />
            ))}
          </div>
        )}
      </ClickableCard>
    </motion.div>
  );
}
