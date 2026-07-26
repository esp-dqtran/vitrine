import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button, Icon, Skeleton, ToggleButton } from '@astryxdesign/core';
import { useSlidingIndicator } from '../useSlidingIndicator';

export interface DetailTab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function resetReferenceDetailScroll(
  scrollTo: (options: ScrollToOptions) => void = (options) => window.scrollTo(options),
) {
  scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

interface ReferenceDetailShellProps<T extends string> {
  title: ReactNode;
  ariaLabel?: string;
  description?: ReactNode;
  className?: string;
  dataDetailKind?: 'app' | 'site';
  identityKey: string;
  identityLabel: string;
  identityImageUrl?: string | null;
  identityContent?: ReactNode;
  accent?: string;
  backLabel?: string;
  onBack?: () => void;
  metadata: Array<{ label: string; value: string; content?: ReactNode }>;
  actions?: ReactNode;
  heroControls?: ReactNode;
  tabs: Array<DetailTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  tabLeading?: ReactNode;
  tabControls?: ReactNode;
  tabTrailing?: ReactNode;
  bodyPadding?: string;
  loading?: boolean;
  children: ReactNode;
}

export function ReferenceDetailShell<T extends string>({
  title,
  ariaLabel,
  description,
  className,
  dataDetailKind,
  identityKey,
  identityLabel,
  identityImageUrl,
  identityContent,
  accent = 'var(--color-accent)',
  backLabel,
  onBack,
  metadata,
  actions,
  heroControls,
  tabs,
  activeTab,
  onTabChange,
  tabLeading,
  tabControls,
  tabTrailing,
  bodyPadding = '8px 40px 80px',
  loading = false,
  children,
}: ReferenceDetailShellProps<T>) {
  const { indicatorRef, registerItem } = useSlidingIndicator<T>(activeTab);
  useEffect(() => resetReferenceDetailScroll(), [identityKey]);
  const accessibleTitle = ariaLabel ?? (typeof title === 'string' ? title : 'Reference');

  return (
    <motion.main
      data-reference-detail={dataDetailKind}
      className={`vitrine-page reference-detail${className ? ` ${className}` : ''}`}
      aria-busy={loading || undefined}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="reference-detail__hero">
        <div className="reference-detail__hero-inner">
          {backLabel && onBack ? (
            <Button
              label={backLabel}
              icon={<Icon icon="chevronLeft" size="sm" />}
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="reference-detail__back"
            />
          ) : null}
          <motion.div
            layoutId={identityKey}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className={`reference-detail__logo${loading ? ' app-detail-loading__logo' : ''}`}
            style={{ background: identityImageUrl ? 'transparent' : accent }}
          >
            {identityContent ?? (identityImageUrl
              ? <img src={identityImageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
              : <span>{identityLabel}</span>)}
          </motion.div>
          <div className={`reference-detail__heading${loading ? ' app-detail-loading__heading' : ''}`}>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          <div className={`reference-detail__metadata${loading ? ' app-detail-loading__metadata' : ''}`}>
            {heroControls}
            {metadata.map(({ label, value, content }) => (
              <div key={label} className={`reference-detail__metadata-item${loading ? ' app-detail-loading__metadata-item' : ''}`}>
                <span>{label}</span>
                {content ?? <strong>{value}</strong>}
              </div>
            ))}
          </div>
          {actions && <div className={`reference-detail__actions${loading ? ' app-detail-loading__actions' : ''}`}>{actions}</div>}
        </div>
        <div className="reference-detail__navigation">
          {tabLeading ? <div className="reference-detail__tab-leading">{tabLeading}</div> : null}
          <div role="tablist" aria-label={`${accessibleTitle} sections`} className={`reference-detail__tabs${loading ? ' app-detail-loading__tabs' : ''}`}>
            {tabs.map((tab, index) => loading ? (
              <Skeleton
                key={tab.id}
                width={index === 2 || index === 5 ? 112 : 78}
                height={20}
                radius={2}
              />
            ) : (
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
                className="reference-detail__tab"
                style={{ color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
              />
            ))}
            {!loading ? <div ref={indicatorRef} className="reference-detail__tab-indicator" /> : null}
            <div style={{ flex: 1 }} />
            {tabTrailing && <div className="reference-detail__tab-trailing">{tabTrailing}</div>}
          </div>
        </div>
        {tabControls}
      </header>
      <div style={{ minHeight: 400 }}>
        <div className="reference-detail__body-inner" style={{ paddingTop: bodyPadding.split(' ')[0], paddingBottom: bodyPadding.split(' ')[2] ?? bodyPadding.split(' ')[0] }}>
          {children}
        </div>
      </div>
    </motion.main>
  );
}
