import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge, ClickableCard, Icon, Text, ToggleButton, type BadgeVariant } from '@astryxdesign/core';
import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';
import type { App, RowStatus } from '../types';

const STATUS_VARIANT: Record<RowStatus, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  Complete: 'success',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

interface AppCardProps {
  app: App;
  onOpen: () => void;
  /** Import/analysis status — omit or pass 'Complete' to render the card exactly as before. */
  status?: RowStatus;
  progressLabel?: string;
}

export function AppCard({ app, onOpen, status, progressLabel }: AppCardProps) {
  const [hovered, setHovered] = useState(false);
  const [index, setIndex] = useState(0);
  // Only slide 0 is ever visible until the user interacts; defer loading the other
  // preview images until first hover/tap so an on-screen card fetches one image, not five.
  const [activated, setActivated] = useState(false);
  // ponytail: card preview caps at 5 screens regardless of how many the app
  // has — the dot/arrow carousel isn't built for hundreds of screens. The full
  // set is still browsable on the detail page.
  const screens = app.screens.slice(0, 5);
  const count = screens.length;
  const go = (i: number) => { setActivated(true); setIndex(((i % count) + count) % count); };

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
        contentVisibility: 'auto', // skip layout/paint for offscreen cards
        containIntrinsicSize: 'auto 240px', // reserve height so the scrollbar stays stable
        transition: 'transform .28s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-6px) scale(1.01)' : 'none',
      }}
    >
      <ClickableCard label={`Open ${app.app}`} onClick={onOpen} padding={0} variant="muted" height="100%" style={{ position: 'relative', overflow: 'hidden', boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)' }}>
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
          {screens.map((s, i) => (
            <div key={i} style={{ flex: `0 0 ${100 / count}%`, height: '100%', position: 'relative' }}>
              {(i === 0 || activated) && <PlaceholderImage src={s.url} accent={app.accent} />}
            </div>
          ))}
        </div>

      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          zIndex: 2,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px 4px 4px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.94)',
          boxShadow: 'var(--shadow-low)',
        }}
      >
        <motion.div layoutId={`app-icon-${app.id}`} style={{ width: 20, height: 20, borderRadius: 6, background: app.iconUrl ? 'transparent' : app.accent, flex: '0 0 auto', overflow: 'hidden', position: 'relative' }}>
          {app.iconUrl && <img src={app.iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
        </motion.div>
        <Text type="supporting" weight="semibold"><span style={{ color: '#18181b' }}>{app.app}</span></Text>
        {progressLabel && status && status !== 'Complete' && <Text type="supporting"><span style={{ color: '#71717a' }}>· {progressLabel}</span></Text>}
      </div>

      {status && status !== 'Complete' && (
        <Badge label={status} variant={STATUS_VARIANT[status]} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, boxShadow: 'var(--shadow-low)' }} />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.28)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity .22s cubic-bezier(.16,1,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <Badge label="View screens" variant="neutral" style={{ color: '#fff', background: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(4px)' }} />
      </div>

      {count > 1 && <ArrowButton direction="left" visible={hovered} onClick={() => go(index - 1)} />}
      {count > 1 && <ArrowButton direction="right" visible={hovered} onClick={() => go(index + 1)} />}
      {count > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 3 }}>
          {screens.map((_, i) => (
            <ToggleButton
              key={i}
              label={`Show preview ${i + 1}`}
              isPressed={i === index}
              isIconOnly
              size="sm"
              icon={<Icon icon="stop" size="sm" />}
              onPressedChange={(_, e) => {
                e.stopPropagation();
                go(i);
              }}
              style={{
                width: i === index ? 14 : 5,
                height: 5,
                minWidth: i === index ? 14 : 5,
                minHeight: 5,
                padding: 0,
                color: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                transition: 'width .15s ease',
              }}
            />
          ))}
        </div>
      )}
      </ClickableCard>
    </motion.div>
  );
}
