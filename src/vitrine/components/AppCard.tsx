import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';
import type { App } from '../types';

interface AppCardProps {
  app: App;
  onOpen: () => void;
  compareSelected: boolean;
  onToggleCompare: () => void;
}

export function AppCard({ app, onOpen, compareSelected, onToggleCompare }: AppCardProps) {
  const [hovered, setHovered] = useState(false);
  const [index, setIndex] = useState(0);
  // ponytail: card preview caps at 5 screens regardless of how many the app
  // has — the dot/arrow carousel isn't built for hundreds of screens. The full
  // set is still browsable on the detail page.
  const screens = app.screens.slice(0, 5);
  const count = screens.length;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        borderRadius: 'var(--radius-container)',
        overflow: 'hidden',
        background: 'var(--color-background-muted)',
        border: '1px solid var(--color-border)',
        boxShadow: hovered ? 'var(--shadow-med)' : 'var(--shadow-low)',
        transition: 'transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s cubic-bezier(.16,1,.3,1)',
        transform: hovered ? 'translateY(-6px) scale(1.01)' : 'none',
      }}
    >
      <button
        type="button"
        aria-pressed={compareSelected}
        aria-label={`${compareSelected ? 'Remove' : 'Add'} ${app.app} ${compareSelected ? 'from' : 'to'} comparison`}
        onClick={(event) => { event.stopPropagation(); onToggleCompare(); }}
        style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, border: '1px solid rgba(255,255,255,.75)', borderRadius: 999, padding: '6px 10px', background: compareSelected ? 'var(--color-accent)' : 'rgba(24,24,27,.72)', color: '#fff', cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 650, backdropFilter: 'blur(5px)' }}
      >
        {compareSelected ? 'Selected' : 'Compare'}
      </button>
      <div onClick={() => onOpen()} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer' }}>
        <div
          style={{
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
              <PlaceholderImage src={s.url} accent={app.accent} />
            </div>
          ))}
        </div>
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
        <motion.div layoutId={`app-icon-${app.id}`} style={{ width: 20, height: 20, borderRadius: 6, background: app.accent, flex: '0 0 auto', overflow: 'hidden', position: 'relative' }}>
          {app.iconUrl && <img src={app.iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        </motion.div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>{app.app}</span>
      </div>

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
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 999,
            background: 'rgba(24,24,27,0.55)',
            backdropFilter: 'blur(4px)',
          }}
        >
          View screens
        </span>
      </div>

      {count > 1 && <ArrowButton direction="left" visible={hovered} onClick={() => go(index - 1)} />}
      {count > 1 && <ArrowButton direction="right" visible={hovered} onClick={() => go(index + 1)} />}
      {count > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 3 }}>
          {screens.map((_, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                go(i);
              }}
              style={{
                width: i === index ? 14 : 5,
                height: 5,
                borderRadius: 3,
                background: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                transition: 'width .15s ease',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
