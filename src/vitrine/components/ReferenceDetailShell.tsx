import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button, Icon, ToggleButton } from '@astryxdesign/core';
import { useSlidingIndicator } from '../useSlidingIndicator';

export interface DetailTab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface ReferenceDetailShellProps<T extends string> {
  title: string;
  identityKey: string;
  identityLabel: string;
  identityImageUrl?: string | null;
  accent?: string;
  backLabel: string;
  onBack: () => void;
  metadata: Array<{ label: string; value: string; content?: ReactNode }>;
  actions?: ReactNode;
  heroControls?: ReactNode;
  tabs: Array<DetailTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  tabControls?: ReactNode;
  tabTrailing?: ReactNode;
  bodyPadding?: string;
  children: ReactNode;
}

export function ReferenceDetailShell<T extends string>({
  title,
  identityKey,
  identityLabel,
  identityImageUrl,
  accent = 'var(--color-accent)',
  backLabel,
  onBack,
  metadata,
  actions,
  heroControls,
  tabs,
  activeTab,
  onTabChange,
  tabControls,
  tabTrailing,
  bodyPadding = '8px 40px 80px',
  children,
}: ReferenceDetailShellProps<T>) {
  const { indicatorRef, registerItem } = useSlidingIndicator<T>(activeTab);

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
      <div style={{ background: 'var(--color-background-surface)' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '22px 40px 0' }}>
          <Button label={backLabel} icon={<Icon icon="chevronLeft" size="sm" />} variant="ghost" size="sm" onClick={onBack} style={{ borderRadius: 8, marginBottom: 28 }} />
          <motion.div
            layoutId={identityKey}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 88, height: 88, borderRadius: 22, background: identityImageUrl ? 'transparent' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden', position: 'relative' }}
          >
            {identityImageUrl
              ? <img src={identityImageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{identityLabel}</span>}
          </motion.div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: '0 0 24px', lineHeight: 1.05 }}>{title}</h1>
          <div style={{ display: 'flex', gap: 40, marginBottom: 28, flexWrap: 'wrap' }}>
            {heroControls}
            {metadata.map(({ label, value, content }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
                {content ?? <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</span>}
              </div>
            ))}
          </div>
          {actions && <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>{actions}</div>}
          <div role="tablist" aria-label={`${title} sections`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28, borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
            {tabs.map((tab) => (
              <ToggleButton
                key={tab.id}
                ref={registerItem(tab.id)}
                label={tab.label}
                isPressed={activeTab === tab.id}
                onPressedChange={() => onTabChange(tab.id)}
                role="tab"
                aria-pressed={undefined}
                aria-selected={activeTab === tab.id}
                size="sm"
                style={{ background: 'none', border: 'none', color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', padding: '0 0 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
              />
            ))}
            <div ref={indicatorRef} style={{ position: 'absolute', bottom: -1, left: 0, height: 2, background: 'var(--color-text-primary)', borderRadius: 1, pointerEvents: 'none' }} />
            <div style={{ flex: 1 }} />
            {tabTrailing && <div style={{ flexShrink: 0, paddingBottom: 14 }}>{tabTrailing}</div>}
          </div>
          {tabControls}
        </div>
      </div>
      <div style={{ minHeight: 400 }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: bodyPadding }}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
